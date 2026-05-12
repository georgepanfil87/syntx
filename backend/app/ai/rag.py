"""RAG — web-search retriever that produces FileSnippet-shaped context.
"""

from __future__ import annotations

import html
import logging
import re
import urllib.parse
from dataclasses import dataclass

import httpx

from app.ai.context import FileSnippet

_logger = logging.getLogger(__name__)


@dataclass(frozen=True, slots=True)
class WebSearchResult:
    """One organic result from the search backend.

    `url` is always the *unwrapped* destination — DDG hides links
    behind `//duckduckgo.com/l/?uddg=...`; we extract the real URL so
    the model sees a usable citation.
    """

    url: str
    title: str
    snippet: str


# DDG lite places each organic hit as two adjacent <td> blocks:
#   <a href="URL" class='result-link'>TITLE</a>
#   ... (whitespace) ...
#   <td class='result-snippet'>SNIPPET</td>
#
# Notes on what the regex must tolerate:
#   * DDG uses **single quotes** for `class=`, double for `href=`.
#     Both attribute orders (href-first vs class-first) appear in
#     the wild, so we don't pin the order.
#   * Whitespace / other tags can appear between the link <td> and
#     the snippet <td>; `.*?` plus DOTALL handles it.
#   * URLs are usually direct, but DDG may wrap with `/l/?uddg=...`;
#     `_unwrap_ddg_url` handles both shapes after extraction.
#
# This is the **single brittle point** of this module. When DDG
# rebrands its CSS classes, fix it here. Failure mode is fail-closed
# (zero matches → empty list → silent RAG skip).
_RESULT_PATTERN = re.compile(
    r"""<a\s+[^>]*?href=["']([^"']+)["'][^>]*?class=['"]result-link['"][^>]*>"""
    r"""(.*?)</a>.*?class=['"]result-snippet['"][^>]*>(.*?)</td>""",
    re.DOTALL | re.IGNORECASE,
)
_TAG_RE = re.compile(r"<[^>]+>")


def _strip_tags(s: str) -> str:
    """Remove HTML tags and decode entities from a fragment."""
    return html.unescape(_TAG_RE.sub("", s)).strip()


def _unwrap_ddg_url(href: str) -> str:
    """Pull the real destination out of DDG's `/l/?uddg=ENCODED` wrapper.

    Returns the input unchanged when it already looks like a direct
    URL — handles the case where DDG occasionally serves the raw
    target without wrapping (and any future backend that doesn't
    wrap at all).
    """
    if href.startswith("//"):
        href = f"https:{href}"
    if "uddg=" not in href:
        return href
    parsed = urllib.parse.urlparse(href)
    target = urllib.parse.parse_qs(parsed.query).get("uddg", [None])[0]
    return target or href


class RagRetriever:
    """Best-effort web-search wrapper. Never raises to callers."""

    def __init__(
        self,
        *,
        search_url: str,
        timeout_seconds: float,
        max_results: int,
    ) -> None:
        self._search_url = search_url
        self._timeout = timeout_seconds
        # Hard cap so a misconfigured setting can't suck in 500 hits.
        self._max_results = max(1, min(max_results, 25))

    async def search(self, query: str) -> list[WebSearchResult]:
        """Run a query, return up to `max_results` parsed hits.

        Always returns a list. Network failures, HTTP errors, and
        layout changes all collapse to `[]` with an INFO log. Callers
        should treat an empty list as "no RAG context this turn" —
        not as a search failure.
        """
        try:
            async with httpx.AsyncClient(
                timeout=self._timeout,
                follow_redirects=True,
            ) as client:
                # POST is the form DDG lite expects; GET works too but
                # POST keeps the query out of any access logs along
                # the way.
                response = await client.post(
                    self._search_url,
                    data={"q": query},
                    headers={
                        # A real-browser UA reduces the odds of being
                        # served a CAPTCHA challenge page. Not a
                        # fingerprint we care to hide.
                        "User-Agent": (
                            "Mozilla/5.0 (compatible; Syntx/0.1; +https://syntx.local)"
                        ),
                    },
                )
                response.raise_for_status()
                body = response.text
        except httpx.HTTPError as exc:
            _logger.info("web search network failure: %s", exc)
            return []

        results: list[WebSearchResult] = []
        for match in _RESULT_PATTERN.finditer(body):
            href_raw, title_raw, snippet_raw = match.group(1, 2, 3)
            results.append(
                WebSearchResult(
                    url=_unwrap_ddg_url(href_raw),
                    title=_strip_tags(title_raw),
                    snippet=_strip_tags(snippet_raw),
                )
            )
            if len(results) >= self._max_results:
                break

        if not results:
            # Absent results may mean the query was unproductive OR
            # that the layout shifted. Both warrant a log so the dev
            # has a breadcrumb when chat replies feel un-grounded.
            _logger.info("web search returned no parseable results for %r", query)

        return results

    async def search_as_snippets(self, query: str) -> list[FileSnippet]:
        """Search and convert hits into the `FileSnippet` shape that
        `ContextEngine` and `prompt_builder` already consume.

        We pack the title and snippet together as the snippet body and
        use the URL as `path` — the markdown fence header in the final
        prompt becomes a citation the model is expected to surface.
        `language=None` so the prompt builder leaves the fence
        untagged (web text isn't code).
        """
        results = await self.search(query)
        return [
            FileSnippet(
                path=r.url,
                content=f"{r.title}\n\n{r.snippet}",
                language=None,
                # Mark as RAG-derived so the budget enforcer knows it
                # may be dropped first when the prompt is over budget.
                source="web",
            )
            for r in results
        ]
