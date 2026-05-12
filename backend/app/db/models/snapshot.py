"""Project snapshot ORM models.

`ProjectSnapshot` — one row per commit, carrying metadata only.
`SnapshotFile`    — content captured at commit time, one row per
                    project file.

The pair forms a content-addressable history substitute. Cheap on
read (no git invocation), straightforward to query (regular SQL),
and immune to filesystem state drift. See the migration's docstring
for the design rationale.
"""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ProjectSnapshot(Base):
    """Commit-level metadata for a project's history."""

    __tablename__ = "project_snapshots"

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    project_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
    )
    # SET NULL on user delete — we keep the commit but lose authorship,
    # which is the standard "anonymise on account delete" behaviour.
    author_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    message: Mapped[str] = mapped_column(Text, nullable=False)
    file_count: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )


class SnapshotFile(Base):
    """One file's content as captured in a single snapshot."""

    __tablename__ = "snapshot_files"
    __table_args__ = (
        UniqueConstraint(
            "snapshot_id", "path", name="uq_snapshot_files_snapshot_id_path",
        ),
    )

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    snapshot_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("project_snapshots.id", ondelete="CASCADE"),
        nullable=False,
    )
    path: Mapped[str] = mapped_column(String(1024), nullable=False)
    content: Mapped[str] = mapped_column(
        Text, nullable=False, default="", server_default="",
    )
    size_bytes: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0",
    )
