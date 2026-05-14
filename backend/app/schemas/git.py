"""Wire-level schemas for the project version-control API.
"""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class CommitCreate(BaseModel):
    """Body of `POST /api/v1/projects/{id}/git/commit`."""

    message: str = Field(..., min_length=1, max_length=512)


class CommitRef(BaseModel):
    """Single row in the history timeline."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    message: str
    file_count: int
    author_id: UUID | None
    created_at: datetime


class CommitDetail(CommitRef):
    """A commit with its captured file list (path + size only)."""

    files: list["SnapshotFileMeta"]


class SnapshotFileMeta(BaseModel):
    """Per-file metadata in the commit detail view."""

    path: str
    size_bytes: int


class StatusFile(BaseModel):
    """A file that differs between the current state and the last commit."""

    path: str
    change: str


class StatusResponse(BaseModel):
    """Response of `GET /api/v1/projects/{id}/git/status`."""

    branch: str = "main"
    commits: int
    last_commit_at: datetime | None
    changed: list[StatusFile]


class CommitListResponse(BaseModel):
    items: list[CommitRef]


class DiffLine(BaseModel):
    """One line in a unified diff. `marker` is ' ', '+' or '-'."""

    marker: str
    content: str


class DiffResponse(BaseModel):
    """Response of `GET /api/v1/projects/{id}/git/diff?commit_id=&path=`.
    """

    path: str
    before: str
    after: str


CommitDetail.model_rebuild()
