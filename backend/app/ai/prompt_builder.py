"""Convert a `ContextPacket` into the message list Ollama receives.
"""

from __future__ import annotations

from typing import Literal

from app.ai.context import ContextPacket, FileSnippet
from app.schemas.ai import ChatMessage

ModelFamily = Literal["qwen-coder", "generic"]


# Coding-assistant preamble. Kept short on purpose: every system token
# costs context window. The instructions cover the failure modes we
# observed while testing locally:
#   * models loved to wrap whole responses in prose — we tell them to
#     keep prose tight and put the deliverable in fenced code blocks
#   * they sometimes invented file paths — we tell them to mirror the
#     paths shown in the workspace context
_QWEN_CODER_PREAMBLE = (
    "You are Syntx, an AI coding assistant embedded in a code editor.\n"
    "- Reply with concise, working code. Prose is for short context only.\n"
    "- When proposing or modifying a file, emit a fenced code block whose\n"
    "  opening fence carries `path=<relative/path>` after the language,\n"
    "  e.g. ```python path=src/foo.py. The block must contain the full\n"
    "  intended file contents — the editor uses this annotation to apply\n"
    "  your suggestion in one click.\n"
    "- Mirror the conventions (language, indent, quoting) of the files in\n"
    "  the workspace context section, when present."
)

_GENERIC_PREAMBLE = (
    "You are Syntx, an AI assistant. Answer concisely and accurately.\n"
    "When code is involved, place it inside fenced code blocks."
)


def detect_family(model: str) -> ModelFamily:
    """Map a model tag to a coarse family.

    Exposed (rather than `_detect_family`) so tests and the eventual
    `/ai/models` endpoint can show the family next to the model name
    without re-implementing the heuristic.
    """
    name = model.lower()
    if "coder" in name and ("qwen" in name or "deepseek" in name):
        return "qwen-coder"
    return "generic"


def _default_preamble(family: ModelFamily) -> str:
    if family == "qwen-coder":
        return _QWEN_CODER_PREAMBLE
    return _GENERIC_PREAMBLE


def _render_snippets(snippets: tuple[FileSnippet, ...]) -> str:
    """Format attached files as a markdown block prefixing the user turn.

    The header `### Workspace context` is a stable anchor. Inside, each
    file is one section with the path as the heading and the body in a
    fenced block. Models trained on GitHub markdown handle this layout
    natively, so we do not need to invent a custom scheme.
    """
    parts: list[str] = ["### Workspace context"]
    for snippet in snippets:
        # Empty `language` produces an untagged fence — valid markdown
        # and the model still infers the language from content.
        lang = snippet.language or ""
        parts.append(f"\n`{snippet.path}`:\n```{lang}\n{snippet.content}\n```")
    return "\n".join(parts)


def build_chat_messages(packet: ContextPacket, *, model: str) -> list[ChatMessage]:
    """Assemble the message list to hand to `OllamaClient.stream_chat()`.
    """
    family = detect_family(model)
    preamble = packet.system_preamble or _default_preamble(family)

    messages: list[ChatMessage] = [ChatMessage(role="system", content=preamble)]
    messages.extend(packet.history)

    if packet.snippets:
        rendered = _render_snippets(packet.snippets)
        # Two newlines: keep the fenced block visually separate from
        # the user's actual question. Some tokenizers treat single vs
        # double newlines differently at boundaries.
        user_content = f"{rendered}\n\n{packet.user_query}"
    else:
        user_content = packet.user_query

    messages.append(ChatMessage(role="user", content=user_content))
    return messages
