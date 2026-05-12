"""Async HTTP client for the Ollama REST API.
"""

from __future__ import annotations

import json
from collections.abc import AsyncIterator, Sequence
from datetime import datetime
from typing import Any

import httpx
from pydantic import BaseModel, Field

# Conservative timeout for the short calls this client makes today
# (`/api/tags` returns in milliseconds on a warm daemon).
_DEFAULT_TIMEOUT_SECONDS = 5.0

# Streaming timeouts. Tokens arrive token-by-token over many seconds on
# CPU-only setups, so the read timeout must be generous. We keep the
# connect timeout short — if Ollama isn't listening, fail fast. `None`
# for the write/pool timeouts is fine: request bodies are small and
# we don't share connections across requests.
_STREAM_CONNECT_TIMEOUT_SECONDS = 5.0
_STREAM_READ_TIMEOUT_SECONDS = 300.0  # 5 min between tokens is plenty

# One-shot completion timeouts (`/api/generate`, non-streaming). The
# default 5 s timeout is suitable for `/api/tags` but starves
# CPU-only Ollama: even `qwen2.5-coder:1.5b` regularly takes 10–30 s
# to emit 64 tokens cold. We connect fast (fail loud if the daemon
# is gone) and read patiently — completions that take longer than
# 60 s are no longer useful as inline ghost text anyway, the user
# has typed past the cursor by then.
_COMPLETE_CONNECT_TIMEOUT_SECONDS = 5.0
_COMPLETE_READ_TIMEOUT_SECONDS = 60.0


class OllamaUnavailable(Exception):
    """Raised when Ollama cannot be reached or returns malformed data.

    One exception class on purpose: the API layer does not need to
    distinguish "connection refused" from "HTTP 502" — both collapse to
    `503 Service Unavailable` at the HTTP boundary.
    """


class OllamaModel(BaseModel):
    """Typed projection of one row from Ollama's `/api/tags` response.

    Ollama returns a number of extra fields (`digest`, `details.*`,
    `format`, ...) that we deliberately ignore here. Adding them is a
    schema-only change when a caller needs them.
    """

    name: str = Field(description="Model identifier, e.g. `qwen2.5-coder:1.5b`.")
    size_bytes: int = Field(ge=0, description="On-disk size of the model weights.")
    modified_at: datetime = Field(description="Last time Ollama touched the weights.")
    digest: str | None = Field(
        default=None,
        description="Content-addressed model digest. Absent on some Ollama versions.",
    )


class OllamaClient:
    """Thin async client over Ollama's HTTP API."""

    def __init__(self, base_url: str, timeout: float = _DEFAULT_TIMEOUT_SECONDS) -> None:
        # Strip a trailing slash once so URL composition stays predictable
        # whether the config value ends with `/` or not.
        self._base_url = base_url.rstrip("/")
        self._timeout = timeout

    @property
    def base_url(self) -> str:
        return self._base_url

    async def is_reachable(self) -> bool:
        """Cheap yes/no probe. Never raises — the whole point of this
        method is to let callers branch on availability without try/except.
        """
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                r = await client.get(f"{self._base_url}/api/tags")
            return r.status_code == 200
        except (httpx.ConnectError, httpx.ConnectTimeout, httpx.ReadTimeout, httpx.HTTPError):
            return False

    async def list_models(self) -> list[OllamaModel]:
        """Return every model currently installed in Ollama.

        Raises `OllamaUnavailable` if the daemon is unreachable OR the
        response body does not match the expected shape (protects the
        API layer from crashing on a newer Ollama schema we haven't
        reviewed yet).
        """
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                response = await client.get(f"{self._base_url}/api/tags")
                response.raise_for_status()
                body: dict[str, Any] = response.json()
        except (httpx.HTTPError, ValueError) as exc:
            raise OllamaUnavailable(str(exc)) from exc

        raw_models = body.get("models")
        if not isinstance(raw_models, list):
            raise OllamaUnavailable(
                f"unexpected response shape from Ollama: missing 'models' list "
                f"(got keys: {sorted(body)})"
            )

        parsed: list[OllamaModel] = []
        for row in raw_models:
            # Ollama uses `size` (bytes) and `modified_at` (ISO-8601).
            # Tolerate missing optional fields; fail loudly on required ones.
            try:
                parsed.append(
                    OllamaModel(
                        name=row["name"],
                        size_bytes=int(row.get("size", 0)),
                        modified_at=row["modified_at"],
                        digest=row.get("digest"),
                    )
                )
            except (KeyError, TypeError, ValueError) as exc:
                raise OllamaUnavailable(
                    f"unparseable model row from Ollama: {row!r} ({exc})"
                ) from exc
        return parsed

    async def stream_chat(
        self,
        *,
        model: str,
        messages: Sequence[dict[str, str]],
    ) -> AsyncIterator[str]:
        """Yield `assistant` content fragments as Ollama generates them.

        Wraps `POST /api/chat` with `stream=true`. Ollama returns
        NDJSON: one JSON object per line. Each object carries a
        `message.content` fragment and a `done` boolean that flips to
        `True` on the final line (along with timing stats we currently
        ignore).
        """
        payload = {"model": model, "messages": list(messages), "stream": True}
        timeout = httpx.Timeout(
            _STREAM_READ_TIMEOUT_SECONDS,
            connect=_STREAM_CONNECT_TIMEOUT_SECONDS,
        )
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                async with client.stream(
                    "POST",
                    f"{self._base_url}/api/chat",
                    json=payload,
                ) as response:
                    if response.status_code != 200:
                        # Drain the body once so the error message is
                        # informative; without `aread()` we'd be left
                        # with an empty string on short failures.
                        body = await response.aread()
                        raise OllamaUnavailable(
                            f"/api/chat returned {response.status_code}: "
                            f"{body.decode(errors='replace')[:500]}"
                        )
                    async for line in response.aiter_lines():
                        if not line:
                            continue
                        try:
                            chunk: dict[str, Any] = json.loads(line)
                        except json.JSONDecodeError as exc:
                            raise OllamaUnavailable(
                                f"malformed NDJSON from Ollama: {line!r}"
                            ) from exc
                        # Ollama uses `{"error": "..."}` for in-band
                        # failures (e.g. unknown model). Treat it as
                        # fatal: the stream is dead from here.
                        if "error" in chunk:
                            raise OllamaUnavailable(
                                f"ollama error: {chunk['error']}"
                            )
                        message = chunk.get("message") or {}
                        content = message.get("content", "")
                        if content:
                            yield content
                        if chunk.get("done"):
                            return
        except httpx.HTTPError as exc:
            # Covers connect refused, read timeout, unexpected EOF, etc.
            # Collapse to our single boundary exception.
            raise OllamaUnavailable(str(exc)) from exc

    async def generate(
        self,
        *,
        model: str,
        prompt: str,
        suffix: str | None = None,
        num_predict: int = 64,
        stop: Sequence[str] | None = None,
    ) -> str:
        """Single-shot completion via Ollama's `/api/generate`.

        Used by inline-completion (STEP 42): editor sends prefix +
        optional suffix → Ollama returns ONE short continuation.
        Streaming would be wasted here — the editor needs the full
        suggestion as an atomic ghost-text insertion, not token-by-token.

        `suffix` enables Ollama's fill-in-the-middle (FIM) mode for
        models that support it (qwen2.5-coder does). Without it, the
        model only sees what comes BEFORE the cursor; with it, the
        model is told what's after, letting it close brackets, return
        early, etc.

        `num_predict` caps the generated length — completions are
        meant to be short bursts (default ~64 tokens), not essays.
        Stops short-circuit on common boundaries (newlines for line
        completions, end-of-statement markers for FIM).
        """
        payload: dict[str, Any] = {
            "model": model,
            "prompt": prompt,
            "stream": False,
            "options": {"num_predict": num_predict},
        }
        if suffix is not None:
            payload["suffix"] = suffix
        if stop:
            payload["stop"] = list(stop)

        # `/api/generate` is non-streaming but the call can still
        # take many seconds on CPU. Use a dedicated read timeout so
        # the short `_DEFAULT_TIMEOUT_SECONDS` (sized for `/api/tags`)
        # doesn't strangle completions.
        timeout = httpx.Timeout(
            _COMPLETE_READ_TIMEOUT_SECONDS,
            connect=_COMPLETE_CONNECT_TIMEOUT_SECONDS,
        )
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.post(
                    f"{self._base_url}/api/generate", json=payload,
                )
        except httpx.HTTPError as exc:
            raise OllamaUnavailable(str(exc)) from exc

        if response.status_code != 200:
            raise OllamaUnavailable(
                f"/api/generate returned {response.status_code}: "
                f"{response.text[:500]}"
            )
        try:
            body = response.json()
        except ValueError as exc:
            raise OllamaUnavailable(
                f"malformed JSON from /api/generate: {response.text[:200]!r}"
            ) from exc
        if "error" in body:
            raise OllamaUnavailable(f"ollama error: {body['error']}")
        return str(body.get("response", ""))

    async def embed(
        self,
        *,
        model: str,
        text: str,
    ) -> list[float]:
        """Compute a single embedding via Ollama's `/api/embeddings`.
        """
        payload = {"model": model, "prompt": text}
        # Embedding calls return in milliseconds on warm GPUs and 1-2 s
        # on cold CPU. Allocate a generous read budget so chunk-heavy
        # files don't bail half-way.
        timeout = httpx.Timeout(
            _COMPLETE_READ_TIMEOUT_SECONDS,
            connect=_COMPLETE_CONNECT_TIMEOUT_SECONDS,
        )
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.post(
                    f"{self._base_url}/api/embeddings", json=payload,
                )
        except httpx.HTTPError as exc:
            raise OllamaUnavailable(str(exc)) from exc

        if response.status_code != 200:
            raise OllamaUnavailable(
                f"/api/embeddings returned {response.status_code}: "
                f"{response.text[:500]}"
            )
        try:
            body = response.json()
        except ValueError as exc:
            raise OllamaUnavailable(
                f"malformed JSON from /api/embeddings: {response.text[:200]!r}"
            ) from exc
        if "error" in body:
            raise OllamaUnavailable(f"ollama embed error: {body['error']}")
        vec = body.get("embedding")
        if not isinstance(vec, list) or not all(isinstance(v, (int, float)) for v in vec):
            raise OllamaUnavailable(
                f"/api/embeddings did not return a numeric vector: {body!r:.200}"
            )
        return [float(v) for v in vec]
