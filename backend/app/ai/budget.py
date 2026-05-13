"""Token budget estimation and prompt truncation policy.
"""

from __future__ import annotations

import logging
import math
from dataclasses import replace

from app.ai.context import ContextPacket, FileSnippet
from app.schemas.ai import ChatMessage

_logger = logging.getLogger(__name__)

_CHARS_PER_TOKEN = 3.5

_PREAMBLE_OVERHEAD_TOKENS = 256

_PROMPT_BUDGET_FRACTION = 0.7

_TRUNCATION_MARKER = "\n\n... [truncated by Syntx budget]"

_MIN_USEFUL_SNIPPET_TOKENS = 64

MODEL_CONTEXT_TOKENS: dict[str, int] = {
    "qwen2.5-coder:1.5b": 8_000,
    "qwen2.5-coder:7b": 32_000,
    "qwen2.5:7b": 32_000,
    "llama3.1:8b": 8_000,
    "deepseek-coder:1.3b": 4_000,
}

DEFAULT_MODEL_CONTEXT_TOKENS = 4_000


def estimate_tokens(text: str) -> int:
    """Estimate the token count of `text` via a chars/token heuristic.
    """
    if not text:
        return 0
    return math.ceil(len(text) / _CHARS_PER_TOKEN)


def context_window_for(model: str) -> int:
    """Look up the practical context window for a model tag.
    """
    return MODEL_CONTEXT_TOKENS.get(model, DEFAULT_MODEL_CONTEXT_TOKENS)


def prompt_budget_for(model: str) -> int:
    """Tokens available for the prompt portion of the request.
    """
    return int(context_window_for(model) * _PROMPT_BUDGET_FRACTION)


def _packet_token_cost(packet: ContextPacket) -> int:
    """Sum-of-parts estimate for everything the packet contributes."""
    cost = _PREAMBLE_OVERHEAD_TOKENS  # reserve for prompt_builder
    cost += estimate_tokens(packet.user_query)
    if packet.system_preamble:
        cost = (
            cost
            - _PREAMBLE_OVERHEAD_TOKENS
            + estimate_tokens(packet.system_preamble)
        )
    for msg in packet.history:
        cost += estimate_tokens(msg.content)
    for snip in packet.snippets:
        cost += estimate_tokens(snip.content) + 16
    return cost


def _truncate_snippet(snippet: FileSnippet, target_tokens: int) -> FileSnippet:
    """Cut a file snippet down to ~target_tokens, append the marker.
    """
    target_chars = max(0, target_tokens * int(_CHARS_PER_TOKEN))
    if len(snippet.content) <= target_chars:
        return snippet
    clipped = snippet.content[:target_chars] + _TRUNCATION_MARKER
    return replace(snippet, content=clipped)


def apply_budget(packet: ContextPacket, *, max_tokens: int) -> ContextPacket:
    """Return a possibly-truncated copy of `packet` that fits the budget.
    """
    cost = _packet_token_cost(packet)
    if cost <= max_tokens:
        return packet

    snippets = list(packet.snippets)
    history = list(packet.history)
    dropped_web = 0
    dropped_history = 0

    # 1) Drop RAG snippets from the tail. Keep file snippets in place.
    while cost > max_tokens and any(s.source == "web" for s in snippets):
        # Find rightmost web snippet (DDG returns best-first → last
        # is least valuable).
        for i in range(len(snippets) - 1, -1, -1):
            if snippets[i].source == "web":
                removed = snippets.pop(i)
                cost -= estimate_tokens(removed.content) + 16
                dropped_web += 1
                break

    # 2) Drop oldest history messages.
    while cost > max_tokens and history:
        removed = history.pop(0)
        cost -= estimate_tokens(removed.content)
        dropped_history += 1

    # 3) Truncate file snippets, largest first. Drop entirely only
    #    if truncating below the useful floor.
    truncated_files: list[str] = []
    while cost > max_tokens and snippets:
        # Largest by content length among the remaining file snippets.
        file_indices = [i for i, s in enumerate(snippets) if s.source == "file"]
        if not file_indices:
            break
        biggest = max(file_indices, key=lambda i: len(snippets[i].content))
        snip = snippets[biggest]
        current = estimate_tokens(snip.content)
        # How many tokens we'd need to shave off this one to fit.
        need = cost - max_tokens
        new_target = max(_MIN_USEFUL_SNIPPET_TOKENS, current - need)
        if new_target >= current:
            # Cannot make progress on this snippet; drop it entirely
            # to avoid an infinite loop.
            snippets.pop(biggest)
            cost -= current + 16
            truncated_files.append(f"{snip.path} (dropped)")
            continue
        snippets[biggest] = _truncate_snippet(snip, new_target)
        cost = cost - current + estimate_tokens(snippets[biggest].content)
        truncated_files.append(snip.path)

    if dropped_web or dropped_history or truncated_files:
        _logger.info(
            "budget enforcement: dropped %d web snippets, %d history msgs; "
            "truncated/dropped files: %s",
            dropped_web,
            dropped_history,
            truncated_files or "none",
        )

    return replace(
        packet,
        snippets=tuple(snippets),
        history=tuple(history),
    )


__all__ = [
    "DEFAULT_MODEL_CONTEXT_TOKENS",
    "MODEL_CONTEXT_TOKENS",
    "apply_budget",
    "context_window_for",
    "estimate_tokens",
    "prompt_budget_for",
]
