"""`SearchService` — keyword + semantic search over project files.
"""

from __future__ import annotations

import logging
from uuid import UUID

from sqlalchemy import or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.ollama import OllamaClient, OllamaUnavailable
from app.db.models.file import File
from app.db.models.file_chunk import FileChunk
from app.repositories.project import ProjectRepository
from app.schemas.search import SearchHit, SearchMode, SearchResponse
from app.services.embeddings import DEFAULT_EMBED_MODEL
from app.services.project import ProjectNotFound

_logger = logging.getLogger(__name__)

# How much surrounding text to include in a keyword-mode snippet.
# Tuned so the snippet plus the path fits on two lines of UI chrome.
_KEYWORD_SNIPPET_LEAD = 32
_KEYWORD_SNIPPET_TRAIL = 96


class SearchUnavailable(Exception):
    """Raised when semantic search can't run (Ollama down, etc.).

    The API layer translates this to a 503 so the frontend can fall
    back to keyword mode and surface a hint to the user.
    """


class SearchService:
    def __init__(
        self,
        session: AsyncSession,
        projects: ProjectRepository,
        ollama: OllamaClient,
        *,
        embed_model: str = DEFAULT_EMBED_MODEL,
    ) -> None:
        self._session = session
        self._projects = projects
        self._ollama = ollama
        self._embed_model = embed_model

    async def search(
        self,
        *,
        owner_id: UUID,
        project_id: UUID,
        query: str,
        mode: SearchMode,
        limit: int,
        min_score: float = 0.0,
    ) -> SearchResponse:
        """Dispatch on `mode`. Both branches share the same response shape.

        `min_score` is honoured by semantic mode only — keyword
        results are exact substring matches with no notion of
        similarity to threshold against.
        """
        await self._require_owned_project(owner_id, project_id)

        query = query.strip()
        if mode == "keyword":
            items = await self._keyword_search(project_id, query, limit)
        else:
            items = await self._semantic_search(
                project_id, query, limit, min_score=min_score,
            )

        return SearchResponse(items=items, mode=mode, query=query)

    # Internals

    async def _require_owned_project(self, owner_id: UUID, project_id: UUID) -> None:
        project = await self._projects.get_by_id(project_id)
        if project is None or project.owner_id != owner_id:
            raise ProjectNotFound(str(project_id))

    async def _keyword_search(
        self, project_id: UUID, query: str, limit: int,
    ) -> list[SearchHit]:
        """ILIKE-based search over file paths + content.

        Ranking is coarse and deterministic:
          - path match  → 1.0
          - content hit → 0.5
        A single file can match both; we surface whichever scores higher.
        """
        like = f"%{query}%"
        rows: list[File] = (
            await self._session.execute(
                select(File)
                .where(File.project_id == project_id)
                .where(or_(File.path.ilike(like), File.content.ilike(like)))
                .order_by(File.path)
                .limit(limit)
            )
        ).scalars().all()

        hits: list[SearchHit] = []
        q_lower = query.lower()
        for row in rows:
            path_match = q_lower in row.path.lower()
            content_match = q_lower in row.content.lower()
            if path_match and not content_match:
                hits.append(
                    SearchHit(
                        path=row.path,
                        snippet=row.path,
                        score=1.0,
                        start_line=-1,
                        end_line=-1,
                    )
                )
                continue
            # Pull a snippet around the first content hit so the UI can
            # show *why* the file matched.
            snippet, start_line, end_line = _extract_keyword_snippet(
                row.content, q_lower,
            )
            hits.append(
                SearchHit(
                    path=row.path,
                    snippet=snippet,
                    score=1.0 if path_match else 0.5,
                    start_line=start_line,
                    end_line=end_line,
                )
            )
        # Stable sort: higher score first, then by path so ties between
        # files with equally-strong matches read alphabetically.
        hits.sort(key=lambda h: (-h.score, h.path))
        return hits

    async def _semantic_search(
        self, project_id: UUID, query: str, limit: int,
        *, min_score: float = 0.0,
    ) -> list[SearchHit]:
        """Cosine-distance kNN over `file_chunks` for this project.

        One Ollama call per request — embeds the query, then the SQL
        does the heavy lifting. We deduplicate by file (the top-N
        chunks for a project often cluster in the same file) so the
        result list shows one row per file with its best chunk.
        """
        try:
            query_vec = await self._ollama.embed(
                model=self._embed_model, text=query,
            )
        except OllamaUnavailable as exc:
            raise SearchUnavailable(
                f"semantic search unavailable: {exc}"
            ) from exc

        # `<=>` is pgvector's cosine-distance operator; lower = closer.
        # We over-fetch by `limit * 3` so the per-file dedup step still
        # has enough rows to fill `limit` files even when one file
        # dominates the top chunks.
        sql = text(
            """
            SELECT
                fc.file_id,
                fc.chunk_index,
                fc.start_line,
                fc.end_line,
                fc.content,
                f.path AS path,
                fc.embedding <=> CAST(:q AS vector) AS distance
            FROM file_chunks fc
            JOIN files f ON f.id = fc.file_id
            WHERE fc.project_id = :pid
            ORDER BY fc.embedding <=> CAST(:q AS vector)
            LIMIT :over_fetch
            """
        )
        result = await self._session.execute(
            sql,
            {
                "pid": project_id,
                "q": _vec_literal(query_vec),
                "over_fetch": limit * 3,
            },
        )
        rows = result.mappings().all()

        # Per-file dedup: keep the lowest-distance chunk for each file.
        # Apply `min_score` as a hard floor so semantic noise (every
        # code file has *some* similarity to every query) doesn't
        # pollute the visible results.
        seen: dict[UUID, SearchHit] = {}
        for row in rows:
            fid = row["file_id"]
            if fid in seen:
                continue
            distance = float(row["distance"])
            similarity = max(0.0, 1.0 - distance)
            if similarity < min_score:
                # Rows are ordered by distance ascending → once we
                # fall below the floor, every subsequent row is also
                # below it. We could `break` here for a small win.
                break
            seen[fid] = SearchHit(
                path=str(row["path"]),
                snippet=_truncate_snippet(str(row["content"])),
                score=similarity,
                start_line=int(row["start_line"]),
                end_line=int(row["end_line"]),
            )
            if len(seen) >= limit:
                break
        return list(seen.values())


def _extract_keyword_snippet(
    content: str, q_lower: str,
) -> tuple[str, int, int]:
    """Return `(snippet, start_line, end_line)` around the first hit.

    Lines are 1-based; we approximate the hit's line by counting
    newlines up to the match offset. Snippets longer than
    LEAD + TRAIL get an ellipsis on both ends to signal truncation.
    """
    idx = content.lower().find(q_lower)
    if idx < 0:
        # No content hit (path-only match). Caller has already handled
        # the path-snippet case; this branch should be unreachable.
        return content[:_KEYWORD_SNIPPET_TRAIL], -1, -1
    start = max(0, idx - _KEYWORD_SNIPPET_LEAD)
    end = min(len(content), idx + len(q_lower) + _KEYWORD_SNIPPET_TRAIL)
    snippet = content[start:end].replace("\n", " ").strip()
    if start > 0:
        snippet = "..." + snippet
    if end < len(content):
        snippet = snippet + "..."
    line = content.count("\n", 0, idx) + 1
    return snippet, line, line


def _truncate_snippet(text: str, max_chars: int = 320) -> str:
    """Cap the semantic-mode chunk preview at `max_chars`."""
    flat = text.replace("\n", " ").strip()
    if len(flat) <= max_chars:
        return flat
    return flat[: max_chars - 1].rstrip() + "..."


def _vec_literal(vec: list[float]) -> str:
    """Render a Python list as pgvector's `[1.0,2.0,3.0]` literal.

    asyncpg's bind-param path doesn't know about the `vector` type
    (the `pgvector` adapter only registers itself for the SQLAlchemy
    ORM column, not raw SQL). Casting via `CAST(:q AS vector)` against
    a string literal sidesteps the adapter entirely.
    """
    return "[" + ",".join(f"{v:.6f}" for v in vec) + "]"
