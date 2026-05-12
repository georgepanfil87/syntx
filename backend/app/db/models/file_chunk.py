"""`FileChunk` ORM model — chunk-level embeddings for semantic search.

Chunks are derived data
-----------------------
A row in `file_chunks` is computed from a row in `files`. There is no
user-facing CRUD: the embeddings service deletes-and-reinserts every
chunk for a file whenever its content changes. This keeps the model
trivial — no `updated_at` mixin, no "stale" flag, no incremental
re-embedding logic. The simplicity costs us a few extra Ollama calls
on every save; that trade reads "spend a model call to keep state
single-sourced" and the model call is cheap on local hardware.

Why `project_id` is denormalised
--------------------------------
The semantic-search query is "embed the user's question, find the
nearest chunks in *this project*". Without `project_id` here we'd
JOIN `file_chunks → files` on every search; the planner handles that
fine for small data, but the JOIN means the ANN index (which only
sees the `embedding` column) can't be the leading access path.
Pulling `project_id` in lets the predicate use a B-tree index on its
own column, then the cosine operator on the embedding. Inserts
re-embed the whole file anyway, so drift between the two columns is
structurally impossible.

Vector dimensionality
---------------------
`Vector(EMBED_DIM)` ties the model to `nomic-embed-text` (768).
Swapping models means a new migration plus an explicit reembedding
backfill — pgvector cannot ALTER between `vector(768)` and
`vector(1024)` in place.
"""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pgvector.sqlalchemy import Vector
from sqlalchemy import DateTime, ForeignKey, Integer, Text, func, text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base

# Must match the migration's EMBED_DIM. The Ollama embed model
# (`nomic-embed-text`) returns 768-dim vectors; if a different
# model is wired in `embeddings.py`, both this constant AND a
# new migration are required.
EMBED_DIM = 768


class FileChunk(Base):
    """One embedding row per chunk of a project file.

    There is intentionally no `updated_at` column — chunks are
    fully replaced on every file save, so "last updated" is
    indistinguishable from `created_at`.
    """

    __tablename__ = "file_chunks"

    id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    file_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("files.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # Denormalised — see module docstring for the rationale.
    project_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # 0-based ordinal — preserves the chunk's position in the file for
    # callers that want to reconstruct surrounding context (e.g. show
    # the chunk before/after a search hit).
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    # 1-based inclusive line range, matching editor convention.
    start_line: Mapped[int] = mapped_column(Integer, nullable=False)
    end_line: Mapped[int] = mapped_column(Integer, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    # `vector(768)` — pgvector type, cosine-indexed in the migration.
    embedding: Mapped[list[float]] = mapped_column(
        Vector(EMBED_DIM),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
