"""`ChatRepository` — the only module that runs SQL against
"""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.chat import ChatMessage, ChatSession
from app.db.models.project import Project


class ChatRepository:
    """Persistence operations for chat sessions and their messages."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    # sessions

    async def get_session(self, session_id: UUID) -> ChatSession | None:
        return await self._session.get(ChatSession, session_id)

    async def get_session_with_owner(
        self, session_id: UUID,
    ) -> tuple[ChatSession, UUID] | None:
        """Return the session and the owning user's id in one round-trip.
        """
        stmt = (
            select(ChatSession, Project.owner_id)
            .join(Project, Project.id == ChatSession.project_id)
            .where(ChatSession.id == session_id)
        )
        row = (await self._session.execute(stmt)).first()
        if row is None:
            return None
        return row[0], row[1]

    async def add_session(self, chat_session: ChatSession) -> ChatSession:
        self._session.add(chat_session)
        await self._session.flush()
        return chat_session

    async def update_title(
        self, chat_session: ChatSession, title: str,
    ) -> ChatSession:
        """Apply a new `title` to an already-loaded session row.
        """
        chat_session.title = title
        await self._session.flush()
        await self._session.refresh(chat_session, ["updated_at"])
        return chat_session

    async def delete_session(self, chat_session: ChatSession) -> None:
        """Delete the session row; CASCADE wipes its messages."""
        await self._session.delete(chat_session)
        await self._session.flush()

    async def list_sessions_for_project(
        self,
        project_id: UUID,
        *,
        limit: int,
        offset: int,
    ) -> list[ChatSession]:
        """Newest sessions first; tiebreak on id for paging stability."""
        stmt = (
            select(ChatSession)
            .where(ChatSession.project_id == project_id)
            .order_by(ChatSession.created_at.desc(), ChatSession.id.desc())
            .limit(limit)
            .offset(offset)
        )
        return list((await self._session.execute(stmt)).scalars().all())

    # messages

    async def add_message(self, message: ChatMessage) -> ChatMessage:
        self._session.add(message)
        await self._session.flush()
        return message

    async def list_messages_for_session(
        self,
        session_id: UUID,
        *,
        limit: int,
        offset: int,
    ) -> list[ChatMessage]:
        """Oldest-first — chat scrollback renders top-to-bottom."""
        stmt = (
            select(ChatMessage)
            .where(ChatMessage.session_id == session_id)
            .order_by(ChatMessage.created_at.asc(), ChatMessage.id.asc())
            .limit(limit)
            .offset(offset)
        )
        return list((await self._session.execute(stmt)).scalars().all())
