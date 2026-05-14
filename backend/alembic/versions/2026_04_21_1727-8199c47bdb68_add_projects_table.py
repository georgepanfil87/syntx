"""add projects table
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "8199c47bdb68"
down_revision: str | None = "28fefa114eaa"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "projects",
        # Aggregate identity — DB-generated so the app never has to guess.
        sa.Column(
            "id",
            sa.UUID(),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        # Ownership. ON DELETE CASCADE: a deleted user takes their
        # projects with them — there is no meaningful ownerless project
        # in this domain.
        sa.Column("owner_id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        # Timestamps — identical shape to `users` (UUIDTimestampMixin).
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
            ["owner_id"],
            ["users.id"],
            ondelete="CASCADE",
        ),
        # Natural domain uniqueness. The B-tree backing this constraint
        # also serves the "list projects for owner X" query, so no
        # separate index on owner_id is created.
        sa.UniqueConstraint("owner_id", "name", name="uq_projects_owner_id_name"),
    )


def downgrade() -> None:
    op.drop_table("projects")
