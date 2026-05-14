"""Chunk-and-embed pipeline for the semantic search index.
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.ollama import OllamaClient, OllamaUnavailable
from app.db.models.file import File
from app.db.models.file_chunk import FileChunk

_logger = logging.getLogger(__name__)

# Sliding-window parameters. See module docstring for rationale.
CHUNK_LINES = 40
CHUNK_OVERLAP = 10
DEFAULT_EMBED_MODEL = "nomic-embed-text"


@dataclass(frozen=True, slots=True)
class Chunk:
    """One slice of a file's content, ready to embed.
    """

    chunk_index: int
    start_line: int
    end_line: int
    content: str


def chunk_text(content: str) -> list[Chunk]:
    """Split `content` into overlapping line-windowed chunks.
    """
    if not content or not content.strip():
        return []
    lines = content.splitlines()
    n = len(lines)
    chunks: list[Chunk] = []
    step = max(1, CHUNK_LINES - CHUNK_OVERLAP)
    i = 0
    chunk_index = 0
    while i < n:
        end = min(i + CHUNK_LINES, n)
        body = "\n".join(lines[i:end])
        if body.strip():
            chunks.append(
                Chunk(
                    chunk_index=chunk_index,
                    start_line=i + 1,  # 1-based for the UI.
                    end_line=end,
                    content=body,
                )
            )
            chunk_index += 1
        if end == n:
            break
        i += step
    return chunks


class EmbeddingsService:
    """Owns the chunk-and-embed lifecycle for a single file.
    """

    def __init__(
        self,
        session: AsyncSession,
        ollama: OllamaClient,
        *,
        model: str = DEFAULT_EMBED_MODEL,
    ) -> None:
        self._session = session
        self._ollama = ollama
        self._model = model

    async def reindex_file(self, file: File) -> int:
        """Re-embed `file` from scratch. Returns the chunk count written.
        """
        chunks = chunk_text(file.content)
        await self._session.execute(
            delete(FileChunk).where(FileChunk.file_id == file.id)
        )

        if not chunks:
            await self._session.commit()
            return 0
        try:
            vectors = await asyncio.gather(
                *(self._ollama.embed(model=self._model, text=c.content) for c in chunks)
            )
        except OllamaUnavailable as exc:
            await self._session.rollback()
            _logger.warning(
                "embeddings: ollama unavailable while indexing file %s (%s)",
                file.id,
                exc,
            )
            return 0

        rows = [
            FileChunk(
                file_id=file.id,
                project_id=file.project_id,
                chunk_index=chunk.chunk_index,
                start_line=chunk.start_line,
                end_line=chunk.end_line,
                content=chunk.content,
                embedding=vec,
            )
            for chunk, vec in zip(chunks, vectors, strict=True)
        ]
        self._session.add_all(rows)
        await self._session.commit()
        return len(rows)
