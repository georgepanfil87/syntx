"""add files table
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c5e2af913b77"
down_revision: str | None = "8199c47bdb68"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "files",
        # Aggregate identity — DB-generated, same pattern as every other
        # table in this project (see ADR-0002).
        sa.Column(
            "id",
            sa.UUID(),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        # Ownership. CASCADE: a file without its project is unreachable
        # garbage; drop it atomically instead of spreading cleanup logic.
        sa.Column("project_id", sa.UUID(), nullable=False),
        sa.Column("path", sa.String(length=1024), nullable=False),
        # Body. TEXT (no length cap at the column); API schemas enforce
        # request-size limits at their boundary.
        sa.Column(
            "content",
            sa.Text(),
            nullable=False,
            server_default="",
        ),
        # Denormalised byte count for tree listings. Kept in sync by the
        # service layer; `server_default 0` covers the initial row state.
        sa.Column(
            "size_bytes",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
        # Timestamps — identical shape to `users` / `projects`.
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["project_id"],
            ["projects.id"],
            ondelete="CASCADE",
        ),
        # Natural domain uniqueness. B-tree prefix on `project_id` also
        # serves "list files of project X" — no separate index needed.
        sa.UniqueConstraint("project_id", "path", name="uq_files_project_id_path"),
    )


def downgrade() -> None:
    op.drop_table("files")
