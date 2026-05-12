"""Wire-level schemas for `chat_sessions` / `chat_messages`.
"""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.db.models.chat import CHAT_SESSION_TITLE_MAX_LENGTH


class ChatSessionRef(BaseModel):
    """One session as advertised in the project sidebar."""

    model_config = ConfigDict(frozen=True, from_attributes=True)

    id: UUID
    project_id: UUID
    title: str
    created_at: datetime
    updated_at: datetime


class ChatSessionList(BaseModel):
    """Envelope for `GET /projects/{id}/chat/sessions`."""

    model_config = ConfigDict(frozen=True)

    items: list[ChatSessionRef] = Field(description="Sessions, newest first.")


class ChatMessageRef(BaseModel):
    """One message in the persisted log."""

    model_config = ConfigDict(frozen=True, from_attributes=True)

    id: UUID
    session_id: UUID
    role: str = Field(description="Either `user` or `assistant`.")
    content: str
    model: str | None = Field(
        default=None,
        description="Ollama model tag that produced this turn (assistant only).",
    )
    token_count: int | None = Field(
        default=None,
        description="Heuristic token estimate captured at write time.",
    )
    created_at: datetime
    updated_at: datetime


class ChatSessionUpdate(BaseModel):
    """Body for `PATCH /chat/sessions/{id}`.
    """

    model_config = ConfigDict(frozen=True)

    title: str = Field(
        min_length=1,
        max_length=CHAT_SESSION_TITLE_MAX_LENGTH,
        description="New sidebar title for the session.",
    )

    @field_validator("title")
    @classmethod
    def _strip_and_validate(cls, raw: str) -> str:
        stripped = raw.strip()
        if not stripped:
            raise ValueError("title must not be blank")
        return stripped


class ChatMessageList(BaseModel):
    """Envelope for `GET /chat/sessions/{id}/messages`."""

    model_config = ConfigDict(frozen=True)

    items: list[ChatMessageRef] = Field(description="Messages, oldest first.")


# Export

CHAT_EXPORT_SCHEMA_VERSION = "syntx.chat-export/1.0"


class ChatSessionExport(BaseModel):
    """Full archival dump of one chat session.
    """

    model_config = ConfigDict(frozen=True)

    schema_version: str = Field(
        default=CHAT_EXPORT_SCHEMA_VERSION,
        description="Format identifier — bump MINOR for additive changes, MAJOR for breaking.",
    )
    session: ChatSessionRef = Field(description="Session metadata at export time.")
    messages: list[ChatMessageRef] = Field(
        description="Full ordered message log, oldest first. No pagination.",
    )
    exported_at: datetime = Field(
        description="UTC instant the server assembled this document.",
    )
