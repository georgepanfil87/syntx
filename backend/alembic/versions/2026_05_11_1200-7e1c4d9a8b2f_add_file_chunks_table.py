"""add file_chunks table for semantic search
"""

from __future__ import annotations

from collections.abc import Sequence

import pgvector.sqlalchemy
import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "7e1c4d9a8b2f"
down_revision: str | None = "a91f4b2c0e91"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Embedding dimensionality. Matches Ollama's nomic-embed-text model.
# Changing this requires a separate migration (vector(N) is a distinct
# type per N — pgvector can't ALTER between them in-place).
EMBED_DIM = 768


def upgrade() -> None:
    op.create_table(
        "file_chunks",
        # DB-generated PK, consistent with every other table.
        sa.Column(
            "id",
            sa.UUID(),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        # CASCADE: chunks are derived data; they vanish with their file.
        sa.Column("file_id", sa.UUID(), nullable=False),
        # Denormalised: the search query filters by project — keeping
        # this here avoids a join on the hot path.
        sa.Column("project_id", sa.UUID(), nullable=False),
        sa.Column("chunk_index", sa.Integer(), nullable=False),
        # 1-based inclusive line range. NULL is invalid; we always
        # know the source lines.
        sa.Column("start_line", sa.Integer(), nullable=False),
        sa.Column("end_line", sa.Integer(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        # Embedding vector. `vector(768)` matches nomic-embed-text.
        sa.Column(
            "embedding",
            pgvector.sqlalchemy.Vector(EMBED_DIM),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["file_id"],
            ["files.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["project_id"],
            ["projects.id"],
            ondelete="CASCADE",
        ),
    )

    # Indexes for the two cascade paths and the project-scoped query.
    op.create_index(
        "ix_file_chunks_file_id",
        "file_chunks",
        ["file_id"],
    )
    op.create_index(
        "ix_file_chunks_project_id",
        "file_chunks",
        ["project_id"],
    )

    # Approximate-NN index on the embedding column using cosine distance.
    # ivfflat is the right pick when chunk count is modest (<100k) and
    # builds in seconds rather than minutes. The application uses the
    # `<=>` operator which this opclass accelerates.
    op.execute(
        """
        CREATE INDEX ix_file_chunks_embedding_cosine
        ON file_chunks
        USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100);
        """
    )


def downgrade() -> None:
    op.drop_index("ix_file_chunks_embedding_cosine", table_name="file_chunks")
    op.drop_index("ix_file_chunks_project_id", table_name="file_chunks")
    op.drop_index("ix_file_chunks_file_id", table_name="file_chunks")
    op.drop_table("file_chunks")
