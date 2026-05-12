"""Wire-level schemas for file-tree and file CRUD responses.
"""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

FILE_CONTENT_MAX_BYTES = 1 * 1024 * 1024  # 1 MiB

_FORBIDDEN_CONTENT_CONTROL = frozenset(
    chr(c) for c in range(0x00, 0x20) if c not in (0x09, 0x0A, 0x0D)
) | {"\x7f"}


class FileTreeEntry(BaseModel):
    """One row in a project's file tree — metadata only, no `content`."""

    model_config = ConfigDict(from_attributes=True)

    path: str
    size_bytes: int = Field(ge=0)
    created_at: datetime
    updated_at: datetime


class FileTree(BaseModel):
    """Envelope for `GET /projects/{project_id}/tree`."""

    project_id: UUID
    items: list[FileTreeEntry]


class FileUpsert(BaseModel):
    """Request body for `PUT /projects/{project_id}/files/{path:path}`.
    """

    content: str

    @field_validator("content")
    @classmethod
    def _validate_content(cls, v: str) -> str:
        """Reject content that exceeds the size cap or carries hostile
        control characters. Enforced at the schema boundary so neither
        the service nor the DB ever sees malformed input."""
        if len(v.encode("utf-8")) > FILE_CONTENT_MAX_BYTES:
            raise ValueError(
                f"content exceeds {FILE_CONTENT_MAX_BYTES} bytes when UTF-8 encoded"
            )
        for ch in v:
            if ch in _FORBIDDEN_CONTENT_CONTROL:
                raise ValueError(
                    "content must not contain control characters "
                    "other than TAB, LF, or CR"
                )
        return v


class FileRead(BaseModel):
    """Response shape for `GET /projects/{project_id}/files/{path:path}`
    and the body of `PUT` responses.

    Includes `content` — this IS the endpoint that pays for body
    transfer. Tree listings use `FileTreeEntry` instead.
    """

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    project_id: UUID
    path: str
    content: str
    size_bytes: int = Field(ge=0)
    created_at: datetime
    updated_at: datetime
