"""AI router — `/api/v1/ai`.
"""

from __future__ import annotations

import json
import logging
from collections.abc import AsyncIterator, Sequence
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.budget import apply_budget, prompt_budget_for
from app.core.metrics import MetricsRecorder, TimedRecord, get_metrics_recorder
from app.ai.context_engine import ContextEngine
from app.ai.ollama import OllamaClient, OllamaUnavailable
from app.ai.prompt_builder import build_chat_messages
from app.ai.rag import RagRetriever
from app.api.deps import get_current_user
from app.core.config import Settings, get_settings
from app.db.models.user import User
from app.db.session import SessionLocal, get_session
from app.repositories.chat import ChatRepository
from app.repositories.file import FileRepository
from app.repositories.project import ProjectRepository
from app.schemas.ai import (
    AiFeatures,
    ChatMessage,
    ChatRequest,
    CompletionRequest,
    CompletionResponse,
    ModelRef,
    ModelsResponse,
    ProjectChatRequest,
)
from app.services.chat import ChatService, ChatSessionNotFound
from app.services.file import FileNotFound, FileService
from app.services.project import ProjectNotFound

_logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai", tags=["ai"])


def get_ollama_client(settings: Settings = Depends(get_settings)) -> OllamaClient:
    """Per-request `OllamaClient` bound to the configured host.

    Kept as a dependency (rather than a module-level singleton) so
    tests can override it via `app.dependency_overrides` without
    reaching into module globals. The client itself is cheap to
    construct — it holds a URL and a timeout, not a live connection.
    """
    return OllamaClient(base_url=settings.ollama_host)


@router.get(
    "/models",
    response_model=ModelsResponse,
    summary="List models available in the local Ollama runtime",
    responses={
        401: {"description": "Missing or invalid bearer token."},
        503: {"description": "Ollama is unreachable or returned malformed data."},
    },
)
async def list_models(
    _current_user: User = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
    ollama: OllamaClient = Depends(get_ollama_client),
    metrics: MetricsRecorder = Depends(get_metrics_recorder),
) -> ModelsResponse:
    """Return every model installed in Ollama plus the backend default.

    The endpoint is authenticated: model availability is part of a
    user's workspace state, not public information, and gating it
    behind the same bearer token keeps the AI surface uniform with the
    rest of `/api/v1`.
    """
    async with TimedRecord(metrics, endpoint="ai.models", model=None) as rec:
        try:
            models = await ollama.list_models()
        except OllamaUnavailable as exc:
            # One error shape, one detail string — the UI does not need to
            # distinguish "refused connection" from "502 from Ollama".
            rec.status = 503
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="ollama is unavailable",
            ) from exc
        rec.status = 200

    default_name = settings.ollama_default_model
    items = [
        ModelRef(
            name=m.name,
            size_bytes=m.size_bytes,
            modified_at=m.modified_at,
            default=(m.name == default_name),
        )
        for m in models
    ]
    return ModelsResponse(items=items, default_model=default_name)


@router.get(
    "/features",
    response_model=AiFeatures,
    summary="Server-advertised AI capability flags",
    responses={401: {"description": "Missing or invalid bearer token."}},
)
async def get_features(
    _current_user: User = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
) -> AiFeatures:
    """Tell the client which optional AI features are wired.

    Used by the chat composer to decide whether to render the
    web-search toggle. Keeping this strictly read-only and limited
    to capability flags avoids leaking ops configuration (search
    URL, timeouts, max results) to authenticated users.
    """
    return AiFeatures(web_search_enabled=settings.web_search_enabled)


def _sse_frame(event: str, data: dict[str, object]) -> str:
    """Encode one SSE frame.

    SSE framing is ASCII-trivial: `event: <name>` + `data: <payload>`
    + blank line. JSON-encoding the payload (rather than free text)
    keeps the parsing rule uniform regardless of content, and the
    double newline terminator is what tells `EventSource` the frame
    is complete.
    """
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


async def _ensure_ollama_reachable(ollama: OllamaClient) -> None:
    """Pre-flight probe used by every streaming endpoint.

    Once `StreamingResponse` flushes the first byte, we own a `200`
    status code — we can no longer say `503`. Probing up front turns
    the common failure mode (Ollama offline) into a clean HTTP error
    rather than an SSE-wrapped `error` event clients would have to
    special-case.
    """
    if not await ollama.is_reachable():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="ollama is unavailable",
        )


async def _persist_assistant_in_fresh_session(
    *, session_id: UUID, content: str, model: str,
) -> None:
    """Write the assistant message in a brand-new DB session.
    """
    try:
        async with SessionLocal() as db:
            chats = ChatService(
                session=db,
                chats=ChatRepository(db),
                projects=ProjectRepository(db),
            )
            await chats.persist_assistant_turn(
                session_id=session_id, content=content, model=model,
            )
    except Exception:  # pragma: no cover - defensive
        _logger.exception(
            "failed to persist assistant turn for session %s", session_id,
        )


def _stream_response(
    *,
    ollama: OllamaClient,
    model: str,
    messages: Sequence[ChatMessage],
    session_id: UUID | None = None,
    metrics: MetricsRecorder | None = None,
    metrics_endpoint: str = "ai.chat",
) -> StreamingResponse:
    """Build the SSE `StreamingResponse` shared by both chat endpoints.

    When `session_id` is provided, the wrapper:
      * emits a leading ``event: session`` frame so the client can pin
        its UI to the session id (esp. if it was just created); and
      * accumulates token fragments into a buffer that is flushed as
        an `assistant` row after the final `done` frame.

    When `session_id` is `None`, the stream is purely transient (the
    `/ai/chat` raw endpoint).
    """
    import time as _time
    wire_messages = [{"role": m.role, "content": m.content} for m in messages]

    async def event_stream() -> AsyncIterator[str]:
        # Time-to-last-token is the user-visible latency for streams,
        # so we measure across the whole event_stream. A mid-stream
        # OllamaUnavailable records as 500 (the SSE error frame is
        # already on the wire — the HTTP status was 200).
        start = _time.perf_counter()
        final_status = 200
        if session_id is not None:
            yield _sse_frame("session", {"id": str(session_id)})

        accumulated: list[str] = []
        try:
            async for fragment in ollama.stream_chat(
                model=model, messages=wire_messages,
            ):
                accumulated.append(fragment)
                yield _sse_frame("token", {"content": fragment})
            yield _sse_frame("done", {})
        except OllamaUnavailable as exc:
            # Mid-stream failure: we can't change the status code, but
            # we can still tell the client something broke. The UI
            # will have rendered the partial tokens up to this point.
            final_status = 500
            yield _sse_frame("error", {"detail": str(exc)})

        # Persist whatever we managed to stream — even a partial
        # reply is auditable history. Empty buffer (no token frames
        # emitted) is also persisted: an empty assistant turn is a
        # meaningful event the UI may want to surface.
        if session_id is not None:
            await _persist_assistant_in_fresh_session(
                session_id=session_id,
                content="".join(accumulated),
                model=model,
            )

        if metrics is not None:
            content = "".join(accumulated)
            metrics.record(
                endpoint=metrics_endpoint,  # type: ignore[arg-type]
                model=model,
                status=final_status,
                latency_ms=(_time.perf_counter() - start) * 1000.0,
                completion_chars=len(content),
            )

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            # Disable response buffering in reverse proxies (nginx in
            # particular) that would otherwise hold frames until a
            # flush threshold. SSE is useless without immediate flush.
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.post(
    "/chat",
    summary="Stream an assistant reply as Server-Sent Events (raw messages)",
    responses={
        200: {
            "description": "SSE stream of `token` frames, terminated by `done`.",
            "content": {"text/event-stream": {}},
        },
        401: {"description": "Missing or invalid bearer token."},
        422: {"description": "Invalid body (empty messages, unknown role, oversize content)."},
        503: {"description": "Ollama is unreachable at stream start."},
    },
)
async def chat(
    body: ChatRequest,
    _current_user: User = Depends(get_current_user),
    ollama: OllamaClient = Depends(get_ollama_client),
    metrics: MetricsRecorder = Depends(get_metrics_recorder),
) -> StreamingResponse:
    """Stream an assistant reply for a raw, client-supplied message list.
    """
    await _ensure_ollama_reachable(ollama)
    return _stream_response(
        ollama=ollama, model=body.model, messages=body.messages,
        metrics=metrics, metrics_endpoint="ai.chat",
    )


# 404 for both "doesn't exist" and "not yours" — same rationale as
# files.py: leaking existence would undo the point of the check.
_PROJECT_NOT_FOUND = HTTPException(
    status_code=status.HTTP_404_NOT_FOUND, detail="project not found",
)
_FILE_NOT_FOUND = HTTPException(
    status_code=status.HTTP_404_NOT_FOUND, detail="file not found",
)


def get_rag_retriever(
    settings: Settings = Depends(get_settings),
) -> RagRetriever | None:
    """Build a `RagRetriever` from settings, or `None` if RAG is off.

    The master switch lives in config (`WEB_SEARCH_ENABLED`) — not in
    the request body — so disabling RAG is an ops decision, not a
    per-call flag clients can flip. When False, every chat is
    guaranteed to be self-contained (no outbound HTTP).
    """
    if not settings.web_search_enabled:
        return None
    return RagRetriever(
        search_url=settings.web_search_url,
        timeout_seconds=settings.web_search_timeout_seconds,
        max_results=settings.web_search_max_results,
    )


def get_chat_service(
    session: AsyncSession = Depends(get_session),
) -> ChatService:
    """Wire `ChatService` over its repositories.

    Same factory shape as `get_context_engine` — keeps handlers free
    of plumbing and gives tests a single override point.
    """
    return ChatService(
        session=session,
        chats=ChatRepository(session),
        projects=ProjectRepository(session),
    )


def get_context_engine(
    session: AsyncSession = Depends(get_session),
    retriever: RagRetriever | None = Depends(get_rag_retriever),
) -> ContextEngine:
    """Wire `ContextEngine` over a request-scoped `FileService` and
    the optional `RagRetriever`.

    Mirrors the factory pattern in `files.py`: assemble the
    collaborator stack here so handlers stay free of plumbing.
    """
    file_service = FileService(
        session=session,
        files=FileRepository(session),
        projects=ProjectRepository(session),
    )
    return ContextEngine(files=file_service, retriever=retriever)


@router.post(
    "/projects/{project_id}/chat",
    summary="Stream a project-aware assistant reply",
    responses={
        200: {
            "description": "SSE stream of `token` frames, terminated by `done`.",
            "content": {"text/event-stream": {}},
        },
        401: {"description": "Missing or invalid bearer token."},
        404: {"description": "Project or one of the file_paths does not exist / not yours."},
        422: {"description": "Body validation failed (bad path, oversize content, …)."},
        503: {"description": "Ollama is unreachable at stream start."},
    },
)
async def project_chat(
    project_id: UUID,
    body: ProjectChatRequest,
    current_user: User = Depends(get_current_user),
    engine: ContextEngine = Depends(get_context_engine),
    chats: ChatService = Depends(get_chat_service),
    ollama: OllamaClient = Depends(get_ollama_client),
    metrics: MetricsRecorder = Depends(get_metrics_recorder),
) -> StreamingResponse:
    """Run a chat turn with snippets pulled server-side from the project,
    persisting both sides of the exchange to a chat session.
    """
    await _ensure_ollama_reachable(ollama)

    try:
        chat_session = await chats.resolve_or_create_session(
            owner_id=current_user.id,
            project_id=project_id,
            session_id=body.session_id,
            user_query=body.user_query,
        )
    except ProjectNotFound as exc:
        raise _PROJECT_NOT_FOUND from exc
    except ChatSessionNotFound as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="chat session not found",
        ) from exc

    # When a session_id was passed we replay the stored log as history,
    # ignoring inline `body.history` (the stored log is the source of
    # truth — see ProjectChatRequest docstring). New sessions use
    # whatever inline history the caller chose to send (typically none).
    if body.session_id is not None:
        stored = await chats.list_messages(
            owner_id=current_user.id,
            session_id=chat_session.id,
            limit=200,
            offset=0,
        )
        # Skip empty-content rows. They occur when a previous stream
        # was aborted before the first token landed — the placeholder
        # assistant row was persisted with an empty body. The Pydantic
        # `ChatMessage` schema enforces `min_length=1`, so feeding the
        # empty row into the constructor would raise ValidationError
        # and 500 the entire chat. Skipping is the right policy: an
        # empty turn carries no signal for the LLM either way.
        history: list[ChatMessage] = [
            ChatMessage(role=m.role, content=m.content)  # type: ignore[arg-type]
            for m in stored
            if m.content and m.content.strip()
        ]
    else:
        history = list(body.history)

    # Record the user turn before we stream
    await chats.persist_user_turn(
        session_id=chat_session.id, content=body.user_query,
    )

    try:
        packet = await engine.build_for_project(
            owner_id=current_user.id,
            project_id=project_id,
            user_query=body.user_query,
            file_paths=body.file_paths,
            history=tuple(history),
            use_web_search=body.use_web_search,
        )
    except ProjectNotFound as exc:
        raise _PROJECT_NOT_FOUND from exc
    except FileNotFound as exc:
        raise _FILE_NOT_FOUND from exc

    packet = apply_budget(packet, max_tokens=prompt_budget_for(body.model))
    messages = build_chat_messages(packet, model=body.model)

    return _stream_response(
        ollama=ollama,
        model=body.model,
        messages=messages,
        session_id=chat_session.id,
        metrics=metrics,
        metrics_endpoint="ai.project_chat",
    )


# Stop sequences for inline completion. We force the model to halt
# at boundaries that make sense for ghost-text suggestions:
#   * triple backtick — the model started writing prose / docs
#   * doubled blank line — the suggestion ran past the current block
# Single newlines are NOT a stop: a python `def …:\n    return x` is
# exactly what we want to suggest as a single insertion.
_COMPLETION_STOPS = ("```", "\n\n\n")


@router.post(
    "/complete",
    response_model=CompletionResponse,
    summary="Single-shot inline code completion (Monaco ghost text)",
    responses={
        200: {"description": "Completion text (may be empty if model declined)."},
        401: {"description": "Missing or invalid bearer token."},
        422: {"description": "Body validation failed."},
        503: {"description": "Ollama is unreachable."},
    },
)
async def complete(
    body: CompletionRequest,
    _current_user: User = Depends(get_current_user),
    ollama: OllamaClient = Depends(get_ollama_client),
    metrics: MetricsRecorder = Depends(get_metrics_recorder),
) -> CompletionResponse:
    """Return one short completion for the editor cursor position.
    """
    async with TimedRecord(metrics, endpoint="ai.complete", model=body.model) as rec:
        if not await ollama.is_reachable():
            rec.status = 503
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="ollama is unavailable",
            )

        # Lead the prefix with a one-line system hint so the model knows
        # the language. Code-completion models (qwen2.5-coder) expect a
        # raw prompt; we cannot use the chat template here.
        prompt = (
            f"# language: {body.language}\n"
            f"{body.prefix}"
        )

        try:
            text = await ollama.generate(
                model=body.model,
                prompt=prompt,
                suffix=body.suffix or None,
                num_predict=body.num_predict,
                stop=_COMPLETION_STOPS,
            )
        except OllamaUnavailable as exc:
            rec.status = 503
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=str(exc),
            ) from exc

        rec.status = 200
        rec.completion_chars = len(text)
        return CompletionResponse(completion=text, model=body.model)
