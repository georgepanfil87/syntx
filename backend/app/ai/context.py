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

    `path` is shown to the model verbatim — it is what tells the
    assistant "this is the code I am asking about". `language` is an
    optional hint used to tag the markdown fenced block; when absent
    we leave the fence untagged and let the model infer from the
    content.

    `source` is metadata used by the budget enforcer (`app.ai.budget`)
    to decide what to drop first when the prompt is over budget. It
    is NOT rendered into the prompt — the model sees only `path`,
    `content`, and `language`. Two values today:

    * ``"file"`` — user-attached project file. Sacred: budget will
      truncate before dropping.
    * ``"web"``  — RAG retriever hit. Best-effort: dropped first
      when over budget.
    """

    path: str
    content: str
    language: str | None = None
    source: SnippetSource = "file"


@dataclass(frozen=True, slots=True)
class ContextPacket:
    """Everything needed to render the next assistant reply.

    Fields
    user_query
        The latest user message in plain text. It will end up as the
        last `role: user` ChatMessage produced by the builder, with
        any snippets folded in front of it.
    history
        Prior turns, oldest first, exactly as they should appear in
        the final messages list. Pass-through; the builder does NOT
        summarise or compress here — that decision belongs upstream.
    snippets
        Files (or excerpts) the model should consider while answering.
        Empty tuple is the no-attachment case.
    system_preamble
        Override for the default model-family preamble. `None` means
        "use the family default". Set explicitly when a feature wants
        to inject a stricter system prompt (e.g. "respond as JSON
        only").
    """

    user_query: str
    history: tuple[ChatMessage, ...] = field(default_factory=tuple)
    snippets: tuple[FileSnippet, ...] = field(default_factory=tuple)
    system_preamble: str | None = None
