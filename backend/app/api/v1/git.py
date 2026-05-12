"""Git router — `/api/v1/projects/{project_id}/git/...`.
"""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.models.user import User
from app.db.session import get_session
from app.repositories.project import ProjectRepository
from app.schemas.git import (
    CommitCreate,
    CommitDetail,
    CommitListResponse,
    CommitRef,
    DiffResponse,
    SnapshotFileMeta,
    StatusFile,
    StatusResponse,
)
from app.services.git import CommitNotFound, GitService
from app.services.project import ProjectNotFound

router = APIRouter(prefix="/projects/{project_id}/git", tags=["git"])

_PROJECT_NOT_FOUND = HTTPException(
    status_code=status.HTTP_404_NOT_FOUND,
    detail="project not found",
)
_COMMIT_NOT_FOUND = HTTPException(
    status_code=status.HTTP_404_NOT_FOUND,
    detail="commit not found",
)


def get_git_service(session: AsyncSession = Depends(get_session)) -> GitService:
    return GitService(session, ProjectRepository(session))


@router.get(
    "/status",
    response_model=StatusResponse,
    summary="Files changed since the last commit",
)
async def git_status(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    service: GitService = Depends(get_git_service),
) -> StatusResponse:
    try:
        commits, latest, changes = await service.status(
            owner_id=current_user.id, project_id=project_id,
        )
    except ProjectNotFound as exc:
        raise _PROJECT_NOT_FOUND from exc
    return StatusResponse(
        commits=commits,
        last_commit_at=latest.created_at if latest else None,
        changed=[StatusFile(path=p, change=c) for p, c in changes],
    )


@router.get(
    "/log",
    response_model=CommitListResponse,
    summary="Commit history (newest first)",
)
async def git_log(
    project_id: UUID,
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    service: GitService = Depends(get_git_service),
) -> CommitListResponse:
    try:
        rows = await service.log(
            owner_id=current_user.id, project_id=project_id, limit=limit,
        )
    except ProjectNotFound as exc:
        raise _PROJECT_NOT_FOUND from exc
    return CommitListResponse(
        items=[CommitRef.model_validate(r) for r in rows],
    )


@router.post(
    "/commit",
    response_model=CommitRef,
    status_code=status.HTTP_201_CREATED,
    summary="Snapshot the project at its current state",
)
async def git_commit(
    body: CommitCreate,
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    service: GitService = Depends(get_git_service),
) -> CommitRef:
    try:
        snapshot = await service.commit(
            owner_id=current_user.id,
            project_id=project_id,
            author_id=current_user.id,
            message=body.message,
        )
    except ProjectNotFound as exc:
        raise _PROJECT_NOT_FOUND from exc
    return CommitRef.model_validate(snapshot)


@router.get(
    "/commits/{commit_id}",
    response_model=CommitDetail,
    summary="One commit, including its captured file list",
)
async def git_commit_detail(
    project_id: UUID,
    commit_id: UUID,
    current_user: User = Depends(get_current_user),
    service: GitService = Depends(get_git_service),
) -> CommitDetail:
    try:
        snapshot, files = await service.get_commit(
            owner_id=current_user.id,
            project_id=project_id,
            commit_id=commit_id,
        )
    except ProjectNotFound as exc:
        raise _PROJECT_NOT_FOUND from exc
    except CommitNotFound as exc:
        raise _COMMIT_NOT_FOUND from exc
    return CommitDetail(
        id=snapshot.id,
        message=snapshot.message,
        file_count=snapshot.file_count,
        author_id=snapshot.author_id,
        created_at=snapshot.created_at,
        files=[SnapshotFileMeta(path=f.path, size_bytes=f.size_bytes) for f in files],
    )


@router.get(
    "/diff",
    response_model=DiffResponse,
    summary="Before/after content for one file at a chosen commit",
)
async def git_diff(
    project_id: UUID,
    commit_id: UUID,
    path: str,
    current_user: User = Depends(get_current_user),
    service: GitService = Depends(get_git_service),
) -> DiffResponse:
    try:
        before, after = await service.diff(
            owner_id=current_user.id,
            project_id=project_id,
            commit_id=commit_id,
            path=path,
        )
    except ProjectNotFound as exc:
        raise _PROJECT_NOT_FOUND from exc
    except CommitNotFound as exc:
        raise _COMMIT_NOT_FOUND from exc
    return DiffResponse(path=path, before=before, after=after)
