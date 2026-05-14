"""Wire-level schemas for `Project`.
"""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

# Mirrors `PROJECT_NAME_MAX_LENGTH` in the ORM model. Duplicating the
# constant (rather than importing from app.db) keeps schemas free of DB
# imports, per the layering rule documented in app/schemas/__init__.py.
PROJECT_NAME_MAX_LENGTH = 120
PROJECT_DESCRIPTION_MAX_LENGTH = 2000


class ProjectCreate(BaseModel):
    """Request body for `POST /api/v1/projects`."""

    name: str = Field(min_length=1, max_length=PROJECT_NAME_MAX_LENGTH)
    description: str | None = Field(
        default=None,
        max_length=PROJECT_DESCRIPTION_MAX_LENGTH,
    )

    @field_validator("name")
    @classmethod
    def _strip_and_require_non_empty(cls, v: str) -> str:
        """Trim surrounding whitespace; reject names that are blank or
        whitespace-only. We intentionally do NOT lowercase or collapse
        internal whitespace — the user's casing and spacing are theirs.
        """
        stripped = v.strip()
        if not stripped:
            raise ValueError("name must contain non-whitespace characters")
        return stripped

    @field_validator("description")
    @classmethod
    def _normalize_description(cls, v: str | None) -> str | None:
        """Trim the description; collapse all-whitespace input to `None`
        so the DB sees a real absence, not a "blank" string."""
        if v is None:
            return None
        stripped = v.strip()
        return stripped or None


class ProjectUpdate(BaseModel):
    """Request body for `PATCH /api/v1/projects/{id}`.
    """

    name: str | None = Field(
        default=None,
        min_length=1,
        max_length=PROJECT_NAME_MAX_LENGTH,
    )
    description: str | None = Field(
        default=None,
        max_length=PROJECT_DESCRIPTION_MAX_LENGTH,
    )

    @field_validator("name")
    @classmethod
    def _strip_and_require_non_empty(cls, v: str | None) -> str | None:
        if v is None:
            return None
        stripped = v.strip()
        if not stripped:
            raise ValueError("name must contain non-whitespace characters")
        return stripped

    @field_validator("description")
    @classmethod
    def _normalize_description(cls, v: str | None) -> str | None:
        if v is None:
            return None
        stripped = v.strip()
        return stripped or None


class ProjectRead(BaseModel):
    """Response shape exposed to clients."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    owner_id: UUID
    name: str
    description: str | None
    created_at: datetime
    updated_at: datetime


class ProjectPage(BaseModel):
    """Paginated envelope for `GET /api/v1/projects`.
    """

    items: list[ProjectRead]
    total: int = Field(ge=0, description="Total projects owned by the caller.")
    limit: int = Field(ge=1, description="Page size that produced `items`.")
    offset: int = Field(ge=0, description="Offset that produced `items`.")
