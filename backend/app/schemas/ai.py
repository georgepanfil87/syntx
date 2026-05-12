"""Wire-level schemas for the AI subsystem.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.db.models.file import InvalidFilePath, normalize_path

CHAT_MESSAGE_MAX_CHARS = 32_000
CHAT_HISTORY_MAX_MESSAGES = 200

COMPLETION_PREFIX_MAX_CHARS = 16_000
COMPLETION_SUFFIX_MAX_CHARS = 4_000
COMPLETION_NUM_PREDICT_MAX = 256
COMPLETION_NUM_PREDICT_DEFAULT = 64

PROJECT_CHAT_MAX_FILE_PATHS = 20


class ModelRef(BaseModel):
    """One installed model, as advertised to API clients.
    """

    model_config = ConfigDict(frozen=True)

    name: str = Field(description="Model identifier, e.g. `qwen2.5-coder:1.5b`.")
    size_bytes: int = Field(ge=0, description="On-disk size of the model weights.")
    modified_at: datetime = Field(description="Last time Ollama touched the weights.")
    default: bool = Field(
        description="True when this model matches OLLAMA_DEFAULT_MODEL.",
    )


class ModelsResponse(BaseModel):
    """Envelope for `GET /ai/models`.
    """

    model_config = ConfigDict(frozen=True)

    items: list[ModelRef] = Field(description="All models currently installed in Ollama.")
    default_model: str = Field(
        description="Model name the backend advertises as default (may not be installed).",
    )


class AiFeatures(BaseModel):
    """Capability advertisement for `GET /ai/features`.
    """

    model_config = ConfigDict(frozen=True)

    web_search_enabled: bool = Field(
        description="True when the RAG retriever is wired and reachable.",
    )


class ChatMessage(BaseModel):
    """One turn in a chat conversation.
    """

    model_config = ConfigDict(frozen=True)

    role: Literal["system", "user", "assistant"] = Field(
        description="Who authored this turn.",
    )
    content: str = Field(
        min_length=1,
        max_length=CHAT_MESSAGE_MAX_CHARS,
        description="Message body, UTF-8 text.",
    )


class ChatRequest(BaseModel):
    """Body for `POST /api/v1/ai/chat`.
    """

    model_config = ConfigDict(frozen=True)

    model: str = Field(
        min_length=1,
        max_length=200,
        description="Ollama model tag, e.g. `qwen2.5-coder:1.5b`.",
    )
    messages: list[ChatMessage] = Field(
        min_length=1,
        max_length=CHAT_HISTORY_MAX_MESSAGES,
        description="Ordered conversation history (oldest first).",
    )


class ProjectChatRequest(BaseModel):
    """Body for `POST /api/v1/ai/projects/{project_id}/chat`.
    """

    model_config = ConfigDict(frozen=True)

    model: str = Field(
        min_length=1,
        max_length=200,
        description="Ollama model tag, e.g. `qwen2.5-coder:1.5b`.",
    )
    user_query: str = Field(
        min_length=1,
        max_length=CHAT_MESSAGE_MAX_CHARS,
        description="The user's prompt for this turn.",
    )
    file_paths: list[str] = Field(
        default_factory=list,
        max_length=PROJECT_CHAT_MAX_FILE_PATHS,
        description="Project-relative file paths to attach as workspace context.",
    )
    history: list[ChatMessage] = Field(
        default_factory=list,
        max_length=CHAT_HISTORY_MAX_MESSAGES,
        description="Optional prior turns. Server-side persistence lands in STEP 29.",
    )
    session_id: UUID | None = Field(
        default=None,
        description=(
            "Existing chat session to append this turn to. When omitted "
            "the server creates a new session, derives its title from "
            "`user_query`, and returns the id in an `event: session` SSE "
            "frame before the first token."
        ),
    )
    use_web_search: bool = Field(
        default=False,
        description=(
            "When True, the server runs the RAG retriever on `user_query` "
            "and appends the hits as workspace context. Silently ignored "
            "when WEB_SEARCH_ENABLED is False on the server."
        ),
    )

    @field_validator("file_paths")
    @classmethod
    def _validate_paths(cls, raw: list[str]) -> list[str]:
        """Run every path through the project-wide path contract.
        """
        validated: list[str] = []
        for p in raw:
            try:
                validated.append(normalize_path(p))
            except InvalidFilePath as exc:
                raise ValueError(f"invalid file_path {p!r}: {exc}") from exc
        return validated


class CompletionRequest(BaseModel):
    """Body for `POST /api/v1/ai/complete` (STEP 42).
    """

    model: str = Field(
        min_length=1,
        description="Ollama model tag, e.g. `qwen2.5-coder:1.5b`.",
    )
    prefix: str = Field(
        max_length=COMPLETION_PREFIX_MAX_CHARS,
        description="Text BEFORE the cursor. May be empty (cursor at file start).",
    )
    suffix: str = Field(
        default="",
        max_length=COMPLETION_SUFFIX_MAX_CHARS,
        description="Text AFTER the cursor. Optional; enables FIM when non-empty.",
    )
    language: str = Field(
        default="plaintext",
        max_length=32,
        description="Editor language id (Monaco vocabulary). Drives the system hint.",
    )
    num_predict: int = Field(
        default=COMPLETION_NUM_PREDICT_DEFAULT,
        ge=1,
        le=COMPLETION_NUM_PREDICT_MAX,
        description="Hard cap on tokens generated for this completion.",
    )


class CompletionResponse(BaseModel):
    """Response for `POST /api/v1/ai/complete`."""

    completion: str = Field(
        description="The text the editor should ghost-render at the cursor.",
    )
    model: str = Field(description="Model that produced the completion.")
