"""Search router — `POST /api/v1/projects/{project_id}/search`.
"""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.ollama import OllamaClient
from app.api.deps import get_current_user
from app.api.v1.ai import get_ollama_client
from app.db.models.file import File
from app.db.models.user import User
from app.db.session import get_session
from app.repositories.project import ProjectRepository
from app.schemas.search import SearchRequest, SearchResponse
from app.services.embeddings import EmbeddingsService
from app.services.project import ProjectNotFound
from app.services.search import SearchService, SearchUnavailable

router = APIRouter(prefix="/projects/{project_id}", tags=["search"])

_PROJECT_NOT_FOUND = HTTPException(
    status_code=status.HTTP_404_NOT_FOUND,
    detail="project not found",
)


def get_search_service(
    session: AsyncSession = Depends(get_session),
    ollama: OllamaClient = Depends(get_ollama_client),
) -> SearchService:
    """Assemble a per-request `SearchService`.
    """
    return SearchService(
        session=session,
        projects=ProjectRepository(session),
        ollama=ollama,
    )


@router.post(
    "/search",
    response_model=SearchResponse,
    summary="Search this project's files (keyword or semantic)",
    responses={
        200: {"description": "Results (possibly empty)."},
        401: {"description": "Missing or invalid bearer token."},
        404: {"description": "Project does not exist or is not yours."},
        503: {
            "description": (
                "Ollama is unreachable. Only raised in semantic mode; "
                "the client can retry in keyword mode for a graceful "
                "degradation."
            ),
        },
    },
)
async def search_project(
    body: SearchRequest,
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    service: SearchService = Depends(get_search_service),
) -> SearchResponse:
    """Run a search over the project's indexed files."""
    try:
        return await service.search(
            owner_id=current_user.id,
            project_id=project_id,
            query=body.query,
            mode=body.mode,
            limit=body.limit,
            min_score=body.min_score,
        )
    except ProjectNotFound as exc:
        raise _PROJECT_NOT_FOUND from exc
    except SearchUnavailable as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc


class ReindexResponse(BaseModel):
    """Summary of a project-wide reindex pass."""

    files_processed: int
    chunks_written: int
    files_failed: int


@router.post(
    "/reindex",
    response_model=ReindexResponse,
    summary="Rebuild the semantic index for every file in this project",
    responses={
        200: {"description": "Reindex complete (some files may have failed; see counters)."},
        401: {"description": "Missing or invalid bearer token."},
        404: {"description": "Project does not exist or is not yours."},
        503: {"description": "Ollama unreachable — no chunks could be written."},
    },
)
async def reindex_project(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    ollama: OllamaClient = Depends(get_ollama_client),
) -> ReindexResponse:
    """Synchronously re-embed every file in the project.
    """
    
    # Ownership check via the repository directly — keeps the public
    # repository surface small (we don't have a "by_id_for_owner" yet).
    projects = ProjectRepository(session)
    project = await projects.get_by_id(project_id)
    if project is None or project.owner_id != current_user.id:
        raise _PROJECT_NOT_FOUND

    files = (
        await session.execute(
            select(File).where(File.project_id == project_id)
        )
    ).scalars().all()

    embeddings = EmbeddingsService(session=session, ollama=ollama)

    files_processed = 0
    chunks_written = 0
    files_failed = 0
   
    for file in files:
        try:
            written = await embeddings.reindex_file(file)
            chunks_written += written
            files_processed += 1
        except Exception:  # pragma: no cover — defensive
            files_failed += 1

    return ReindexResponse(
        files_processed=files_processed,
        chunks_written=chunks_written,
        files_failed=files_failed,
    )
