"""`ChatSession` and `ChatMessage` ORM models.
"""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, UUIDTimestampMixin

CHAT_SESSION_TITLE_MAX_LENGTH = 200

CHAT_MESSAGE_ROLE_MAX_LENGTH = 16


class ChatSession(Base, UUIDTimestampMixin):
    """One conversation thread inside a project."""

    __tablename__ = "chat_sessions"

    project_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(
        String(CHAT_SESSION_TITLE_MAX_LENGTH),
        nullable=False,
    )

    __table_args__ = (
        Index(
            "ix_chat_sessions_project_id_created_at",
            "project_id",
            "created_at",
        ),
    )


class ChatMessage(Base, UUIDTimestampMixin):
    """One turn (user or assistant) inside a chat session."""

    __tablename__ = "chat_messages"

    session_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("chat_sessions.id", ondelete="CASCADE"),
        nullable=False,
    )
    role: Mapped[str] = mapped_column(
        String(CHAT_MESSAGE_ROLE_MAX_LENGTH),
        nullable=False,
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    model: Mapped[str | None] = mapped_column(String(200), nullable=True)
    token_count: Mapped[int | None] = mapped_column(Integer, nullable=True)

    __table_args__ = (
        Index(
            "ix_chat_messages_session_id_created_at",
            "session_id",
            "created_at",
        ),
    )
