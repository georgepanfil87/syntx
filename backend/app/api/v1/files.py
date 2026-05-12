"""Files router — `/api/v1/projects/{project_id}/...`.
"""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.ollama import OllamaClient
from app.api.deps import get_current_user
from app.api.v1.ai import get_ollama_client
from app.core.config import Settings, get_settings
from app.db.models.file import File, InvalidFilePath, normalize_path
from app.db.models.user import User
from app.db.session import SessionLocal, get_session
from app.repositories.file import FileRepository
from app.repositories.project import ProjectRepository
from app.schemas.file import FileRead, FileTree, FileUpsert
from app.services.embeddings import EmbeddingsService
from app.services.file import FileNotFound, FileService
from app.services.project import ProjectNotFound


router = APIRouter(prefix="/projects/{project_id}", tags=["files"])


def get_file_service(session: AsyncSession = Depends(get_session)) -> FileService:
    """Assemble a `FileService` with its two repo collaborators.
    """
    return FileService(
        session=session,
        files=FileRepository(session),
        projects=ProjectRepository(session),
    )

_PROJECT_NOT_FOUND = HTTPException(
    status_code=status.HTTP_404_NOT_FOUND,
    detail="project not found",
)

_FILE_NOT_FOUND = HTTPException(
    status_code=status.HTTP_404_NOT_FOUND,
    detail="file not found",
)


def get_valid_path(path: str) -> str:
    """Run path-param through the canonical `normalize_path` validator.
    """
    try:
        return normalize_path(path)
    except InvalidFilePath as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc


@router.get(
    "/tree",
    response_model=FileTree,
    summary="List the project's file tree (metadata only)",
    responses={
        401: {"description": "Missing or invalid bearer token."},
        404: {"description": "Project does not exist or is not owned by you."},
    },
)
async def get_project_tree(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    service: FileService = Depends(get_file_service),
) -> FileTree:
    """Return every file in the project, metadata-only, sorted by `path`.
    """
    try:
        return await service.tree_for_owner(
            owner_id=current_user.id,
            project_id=project_id,
        )
    except ProjectNotFound as exc:
        raise _PROJECT_NOT_FOUND from exc


@router.get(
    "/files/{path:path}",
    response_model=FileRead,
    summary="Read a single file (content included)",
    responses={
        401: {"description": "Missing or invalid bearer token."},
        404: {"description": "Project or file does not exist / not yours."},
        422: {"description": "Path fails the project path contract."},
    },
)
async def read_file(
    project_id: UUID,
    path: str = Depends(get_valid_path),
    current_user: User = Depends(get_current_user),
    service: FileService = Depends(get_file_service),
) -> FileRead:
    """Return a file's body + metadata."""
    try:
        file = await service.get_file_for_owner(
            owner_id=current_user.id,
            project_id=project_id,
            path=path,
        )
    except ProjectNotFound as exc:
        raise _PROJECT_NOT_FOUND from exc
    except FileNotFound as exc:
        raise _FILE_NOT_FOUND from exc
    return FileRead.model_validate(file)


@router.put(
    "/files/{path:path}",
    response_model=FileRead,
    summary="Create or replace a file at `path` (idempotent upsert)",
    responses={
        200: {"description": "File existed and was replaced."},
        201: {"description": "File did not exist and was created."},
        401: {"description": "Missing or invalid bearer token."},
        404: {"description": "Project does not exist or is not yours."},
        422: {"description": "Path or body fails validation."},
    },
)
async def upsert_file(
    body: FileUpsert,
    response: Response,
    background: BackgroundTasks,
    project_id: UUID,
    path: str = Depends(get_valid_path),
    current_user: User = Depends(get_current_user),
    service: FileService = Depends(get_file_service),
    settings: Settings = Depends(get_settings),
) -> FileRead:
    """Create the file if it doesn't exist, replace its content if it
    does. A second call with identical body is a no-op semantically —
    same row, same content."""
    try:
        file, created = await service.upsert_file(
            owner_id=current_user.id,
            project_id=project_id,
            path=path,
            payload=body,
        )
    except ProjectNotFound as exc:
        raise _PROJECT_NOT_FOUND from exc

    # Reindex the embeddings off the hot path. We snapshot the file
    # id + content here (not the ORM object) because the request's
    # session is closed by the time the background task runs — passing
    # the bound entity would dereference a detached row.
    background.add_task(
        _reindex_file_in_background,
        file_id=file.id,
        project_id=file.project_id,
        content=file.content,
        ollama_host=settings.ollama_host,
    )

    response.status_code = (
        status.HTTP_201_CREATED if created else status.HTTP_200_OK
    )
    return FileRead.model_validate(file)


async def _reindex_file_in_background(
    *,
    file_id: UUID,
    project_id: UUID,
    content: str,
    ollama_host: str,
) -> None:
    """Re-embed a file's chunks in a fresh session.

    Runs after the upsert handler returns. We open a new
    `SessionLocal()` because the request's session is already closed.
    Failures are swallowed (logged in EmbeddingsService) so a slow or
    down Ollama never blocks the user's save.
    """
    transient = File(
        id=file_id,
        project_id=project_id,
        path="",  # not read by the embeddings pipeline
        content=content,
        size_bytes=len(content.encode("utf-8")),
    )
    async with SessionLocal() as session:
        ollama = OllamaClient(base_url=ollama_host)
        embeddings = EmbeddingsService(session=session, ollama=ollama)
        await embeddings.reindex_file(transient)


@router.delete(
    "/files/{path:path}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a file (idempotent; no error if absent)",
    responses={
        204: {"description": "File is gone (whether or not it existed before)."},
        401: {"description": "Missing or invalid bearer token."},
        404: {"description": "Project does not exist or is not yours."},
        422: {"description": "Path fails the project path contract."},
    },
)
async def delete_file(
    project_id: UUID,
    path: str = Depends(get_valid_path),
    current_user: User = Depends(get_current_user),
    service: FileService = Depends(get_file_service),
) -> Response:
    """Drop a file. Returns `204` even if the file did not exist — HTTP
    DELETE is idempotent, and retry-safe clients rely on that."""
    try:
        await service.delete_file(
            owner_id=current_user.id,
            project_id=project_id,
            path=path,
        )
    except ProjectNotFound as exc:
        raise _PROJECT_NOT_FOUND from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)
