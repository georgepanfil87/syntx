"""Projects router — `/api/v1/projects`.
"""

from __future__ import annotations

from uuid import UUID

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    Response,
    UploadFile,
    status,
)
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.models.user import User
from app.db.session import get_session
from app.repositories.file import FileRepository
from app.repositories.project import ProjectRepository
from app.schemas.project import (
    ProjectCreate,
    ProjectPage,
    ProjectRead,
    ProjectUpdate,
)
from app.services.export_import import (
    MAX_IMPORT_SIZE_BYTES,
    ExportImportService,
    ImportError_ as ProjectImportError,
)
from app.services.project import (
    ProjectNameAlreadyTaken,
    ProjectNotFound,
    ProjectService,
)

router = APIRouter(prefix="/projects", tags=["projects"])


def get_project_service(session: AsyncSession = Depends(get_session)) -> ProjectService:
    """Assemble a `ProjectService` for the request-scoped session.
    """
    return ProjectService(session, ProjectRepository(session))


@router.post(
    "",
    response_model=ProjectRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create a project owned by the authenticated user",
    responses={
        401: {"description": "Missing or invalid bearer token."},
        409: {"description": "You already have a project with this name."},
    },
)
async def create_project(
    body: ProjectCreate,
    current_user: User = Depends(get_current_user),
    service: ProjectService = Depends(get_project_service),
) -> ProjectRead:
    """Create a new project.
    """
    try:
        project = await service.create(owner_id=current_user.id, payload=body)
    except ProjectNameAlreadyTaken as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="you already have a project with this name",
        ) from exc
    return ProjectRead.model_validate(project)

_LIMIT_DEFAULT = 50
_LIMIT_MAX = 200


@router.get(
    "",
    response_model=ProjectPage,
    summary="List the authenticated user's projects (newest first)",
    responses={401: {"description": "Missing or invalid bearer token."}},
)
async def list_projects(
    current_user: User = Depends(get_current_user),
    service: ProjectService = Depends(get_project_service),
    limit: int = Query(
        default=_LIMIT_DEFAULT,
        ge=1,
        le=_LIMIT_MAX,
        description="Max items to return (1..200).",
    ),
    offset: int = Query(
        default=0,
        ge=0,
        description="Rows to skip before collecting `limit` items.",
    ),
) -> ProjectPage:
    """Return projects owned by the caller.
    """
    return await service.list_for_owner(
        owner_id=current_user.id,
        limit=limit,
        offset=offset,
    )


@router.get(
    "/{project_id}",
    response_model=ProjectRead,
    summary="Read a single project owned by the caller",
    responses={
        401: {"description": "Missing or invalid bearer token."},
        404: {"description": "Project does not exist or is not owned by the caller."},
    },
)
async def read_project(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    service: ProjectService = Depends(get_project_service),
) -> ProjectRead:
    """Return a single project. Used by the SPA when the user lands
    directly on `/workspace/projects/{id}` (refresh, deep-link from
    chat) — the list response has the same data, but we don't want
    deep-link loads to depend on the full page being warm.
    """
    try:
        project = await service.get_for_owner(project_id, current_user.id)
    except ProjectNotFound as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="project not found",
        ) from exc
    return ProjectRead.model_validate(project)


@router.patch(
    "/{project_id}",
    response_model=ProjectRead,
    summary="Rename or update a project",
    responses={
        401: {"description": "Missing or invalid bearer token."},
        404: {"description": "Project does not exist or is not owned by the caller."},
        409: {"description": "Another project of yours already uses this name."},
    },
)
async def update_project(
    project_id: UUID,
    body: ProjectUpdate,
    current_user: User = Depends(get_current_user),
    service: ProjectService = Depends(get_project_service),
) -> ProjectRead:
    """Apply a partial update to a project owned by the caller.
    """
    try:
        project = await service.update_for_owner(
            project_id=project_id,
            owner_id=current_user.id,
            payload=body,
        )
    except ProjectNotFound as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="project not found",
        ) from exc
    except ProjectNameAlreadyTaken as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="you already have a project with this name",
        ) from exc
    return ProjectRead.model_validate(project)


@router.delete(
    "/{project_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a project (and its files / chat sessions via cascade)",
    responses={
        401: {"description": "Missing or invalid bearer token."},
        404: {"description": "Project does not exist or is not owned by the caller."},
    },
)
async def delete_project(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    service: ProjectService = Depends(get_project_service),
) -> Response:
    """Delete a project owned by the caller.

    Returns 204 with an empty body on success — RFC-compliant and lets
    the SPA reduce client logic to a "did the network call resolve?"
    check. The cascade on `Project` removes files and chat sessions in
    the same transaction.
    """
    try:
        await service.delete_for_owner(project_id=project_id, owner_id=current_user.id)
    except ProjectNotFound as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="project not found",
        ) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# Import / Export
def get_export_import_service(
    session: AsyncSession = Depends(get_session),
) -> ExportImportService:
    """Assemble the export/import service with its three collaborators.
    """
    return ExportImportService(
        session=session,
        projects=ProjectRepository(session),
        files=FileRepository(session),
        project_service=ProjectService(session, ProjectRepository(session)),
    )


@router.get(
    "/{project_id}/export",
    summary="Download the project as a portable ZIP bundle",
    responses={
        200: {
            "description": "ZIP archive containing manifest + all files.",
            "content": {"application/zip": {}},
        },
        401: {"description": "Missing or invalid bearer token."},
        404: {"description": "Project does not exist or is not owned by the caller."},
    },
)
async def export_project(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    service: ExportImportService = Depends(get_export_import_service),
) -> Response:
    """Stream the project as a ZIP download.

    The archive contains a `syntx-manifest.json` plus a `files/`
    tree with every file at its original project-relative path.
    The `Content-Disposition` header carries a filename derived from
    the project name so the browser saves it sensibly.
    """
    try:
        zip_bytes, filename = await service.export_project(
            owner_id=current_user.id, project_id=project_id,
        )
    except ProjectNotFound as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="project not found",
        ) from exc
    return Response(
        content=zip_bytes,
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )


@router.post(
    "/import",
    response_model=ProjectRead,
    status_code=status.HTTP_201_CREATED,
    summary="Import a previously-exported project ZIP",
    responses={
        201: {"description": "Project + all files imported."},
        400: {"description": "Archive is malformed, oversize, or invalid."},
        401: {"description": "Missing or invalid bearer token."},
        409: {"description": "Could not find a free name (rare)."},
    },
)
async def import_project(
    archive: UploadFile,
    current_user: User = Depends(get_current_user),
    service: ExportImportService = Depends(get_export_import_service),
) -> ProjectRead:
    """Accept a Syntx ZIP and create a new project from it.

    The endpoint reads the whole upload into memory — bounded by
    `MAX_IMPORT_SIZE_BYTES` so a hostile client can't exhaust RAM.
    The new project's name comes from the manifest, with a
    "(imported)" suffix on collision so the user can spot it
    immediately in the project list.
    """
    raw = await archive.read()
    if len(raw) > MAX_IMPORT_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"archive exceeds {MAX_IMPORT_SIZE_BYTES} bytes",
        )
    try:
        project = await service.import_project(
            owner_id=current_user.id, zip_bytes=raw,
        )
    except ProjectImportError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except ProjectNameAlreadyTaken as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="could not find an available name for this import",
        ) from exc
    return ProjectRead.model_validate(project)
