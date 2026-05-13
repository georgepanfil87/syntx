"""Assemble a `ContextPacket` from server-side state.
"""

from __future__ import annotations

import os
from collections.abc import Sequence
from uuid import UUID

from app.ai.context import ContextPacket, FileSnippet
from app.ai.rag import RagRetriever
from app.schemas.ai import ChatMessage
from app.services.file import FileService

_EXT_TO_LANGUAGE: dict[str, str] = {
    ".py": "python",
    ".pyi": "python",
    ".ts": "typescript",
    ".tsx": "tsx",
    ".js": "javascript",
    ".jsx": "jsx",
    ".html": "html",
    ".htm": "html",
    ".css": "css",
    ".scss": "scss",
    ".json": "json",
    ".md": "markdown",
    ".yaml": "yaml",
    ".yml": "yaml",
    ".toml": "toml",
    ".sql": "sql",
    ".sh": "bash",
    ".bash": "bash",
    ".dockerfile": "dockerfile",
    ".go": "go",
    ".rs": "rust",
    ".java": "java",
    ".rb": "ruby",
    ".c": "c",
    ".h": "c",
    ".cpp": "cpp",
    ".hpp": "cpp",
}


def infer_language(path: str) -> str | None:
    """Map a file path's extension to a markdown fence tag.
    """
    ext = os.path.splitext(path)[1].lower()
    return _EXT_TO_LANGUAGE.get(ext)


class ContextEngine:
    """Build a `ContextPacket` for one chat turn.
    """

    def __init__(
        self,
        files: FileService,
        retriever: RagRetriever | None = None,
    ) -> None:
        self._files = files
        # `None` means "RAG disabled in this deployment". The engine
        # silently ignores `use_web_search=True` in that case — the
        # request still succeeds, just without web context. This is
        # the right default for tests and for environments without
        # outbound internet access.
        self._retriever = retriever

    async def build_for_project(
        self,
        *,
        owner_id: UUID,
        project_id: UUID,
        user_query: str,
        file_paths: Sequence[str] = (),
        history: Sequence[ChatMessage] = (),
        system_preamble: str | None = None,
        use_web_search: bool = False,
    ) -> ContextPacket:
        """Load every requested file and pack it into a `ContextPacket`.
        """
        snippets: list[FileSnippet] = []
        for path in file_paths:
            file = await self._files.get_file_for_owner(
                owner_id=owner_id,
                project_id=project_id,
                path=path,
            )
            snippets.append(
                FileSnippet(
                    path=file.path,
                    content=file.content,
                    language=infer_language(file.path),
                )
            )

        if not file_paths:
            await self._files.tree_for_owner(
                owner_id=owner_id, project_id=project_id
            )


        if use_web_search and self._retriever is not None:
            web_snippets = await self._retriever.search_as_snippets(user_query)
            snippets.extend(web_snippets)

        return ContextPacket(
            user_query=user_query,
            history=tuple(history),
            snippets=tuple(snippets),
            system_preamble=system_preamble,
        )
