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

# Closed mapping: extension → markdown fence tag. Anything not listed
# yields `None`, which the prompt builder renders as an untagged fence.
# Adding a language is a one-line change. We deliberately do NOT use a
# library like `pygments`: the value is a fence tag, not a parser.
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

    Returns `None` for unknown extensions; the prompt builder treats
    that as "untagged fence". Case-insensitive on the extension; the
    rest of the path is irrelevant.
    """
    ext = os.path.splitext(path)[1].lower()
    return _EXT_TO_LANGUAGE.get(ext)


class ContextEngine:
    """Build a `ContextPacket` for one chat turn.

    Today the only inputs that affect the packet are project files
    referenced by path. Future steps will add `history` (from a
    message repository) and `snippets` from RAG retrieval. The
    function signature is therefore deliberately keyword-only — new
    optional kwargs can be added without breaking callers.
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

        Raises:
        
        ProjectNotFound
            The project does not exist or is not owned by `owner_id`.
            Raised on the first `get_file_for_owner` call (or on a
            stand-alone ownership check below when `file_paths` is
            empty).
        FileNotFound
            One of the requested paths does not exist in this project.
            We fail fast on the first missing path: a partial context
            would silently change the prompt vs. what the caller
            asked for, which is worse than an error.

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

        # When `file_paths` is empty we still need to validate that the
        # project belongs to the caller — otherwise a wrong project_id
        # would silently produce a snippet-less reply, leaking nothing
        # but also confusing debug. We piggyback on `tree_for_owner`
        # because it already runs the ownership guard and is cheap on
        # an empty project.
        if not file_paths:
            await self._files.tree_for_owner(
                owner_id=owner_id, project_id=project_id
            )

        # RAG: append web-search snippets after the workspace files so
        # the prompt reads as "your code, then external context, then
        # the question". Engine never raises on RAG failure; the
        # retriever returns `[]` when search is unavailable.
        if use_web_search and self._retriever is not None:
            web_snippets = await self._retriever.search_as_snippets(user_query)
            snippets.extend(web_snippets)

        return ContextPacket(
            user_query=user_query,
            history=tuple(history),
            snippets=tuple(snippets),
            system_preamble=system_preamble,
        )
