"""Internal data structures consumed by the prompt builder.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

from app.schemas.ai import ChatMessage


SnippetSource = Literal["file", "web"]


@dataclass(frozen=True, slots=True)
class FileSnippet:
    """One file (or excerpt) attached to a turn for the model to read.
    """

    path: str
    content: str
    language: str | None = None
    source: SnippetSource = "file"


@dataclass(frozen=True, slots=True)
class ContextPacket:
    """Everything needed to render the next assistant reply.
    """

    user_query: str
    history: tuple[ChatMessage, ...] = field(default_factory=tuple)
    snippets: tuple[FileSnippet, ...] = field(default_factory=tuple)
    system_preamble: str | None = None
