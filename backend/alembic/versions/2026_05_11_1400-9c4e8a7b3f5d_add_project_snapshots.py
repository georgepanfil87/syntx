"""add project snapshots (mini version control)
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "9c4e8a7b3f5d"
down_revision: str | None = "7e1c4d9a8b2f"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "project_snapshots",
        sa.Column(
            "id",
            sa.UUID(),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("project_id", sa.UUID(), nullable=False),
        sa.Column("author_id", sa.UUID(), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        # Denormalised file count for the timeline UI — avoids a
        # COUNT(*) join on every log render.
        sa.Column(
            "file_count",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["project_id"], ["projects.id"], ondelete="CASCADE",
        ),
        # Author is NOT cascade-deleted — preserving the historical
        # "who wrote this commit" is more useful than the row count.
        # We just SET NULL the author column instead.
        sa.ForeignKeyConstraint(
            ["author_id"], ["users.id"], ondelete="SET NULL",
        ),
    )
    op.create_index(
        "ix_project_snapshots_project_id_created_at",
        "project_snapshots",
        ["project_id", sa.text("created_at DESC")],
    )

    op.create_table(
        "snapshot_files",
        sa.Column(
            "id",
            sa.UUID(),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("snapshot_id", sa.UUID(), nullable=False),
        sa.Column("path", sa.String(length=1024), nullable=False),
        sa.Column("content", sa.Text(), nullable=False, server_default=""),
        sa.Column(
            "size_bytes",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["snapshot_id"], ["project_snapshots.id"], ondelete="CASCADE",
        ),
        sa.UniqueConstraint(
            "snapshot_id", "path", name="uq_snapshot_files_snapshot_id_path",
        ),
    )


def downgrade() -> None:
    op.drop_table("snapshot_files")
    op.drop_index(
        "ix_project_snapshots_project_id_created_at",
        table_name="project_snapshots",
    )
    op.drop_table("project_snapshots")
