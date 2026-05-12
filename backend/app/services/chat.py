"""`ChatService` — business logic over `chat_sessions` / `chat_messages`.
"""

from __future__ import annotations

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.budget import estimate_tokens
from app.db.models.chat import (
    CHAT_SESSION_TITLE_MAX_LENGTH,
    ChatMessage,
    ChatSession,
)
from app.repositories.chat import ChatRepository
from app.repositories.project import ProjectRepository
from app.services.project import ProjectNotFound


class ChatSessionNotFound(Exception):
    """Raised when a session id either doesn't exist or doesn't belong
    to the caller's project. One exception covers both cases — the API
    layer maps to `404` so the response cannot leak existence.
    """


def _derive_title(user_query: str) -> str:
    """Single-line, length-capped title from the first user message.
    """
    for line in user_query.splitlines():
        stripped = line.strip()
        if stripped:
            if len(stripped) > CHAT_SESSION_TITLE_MAX_LENGTH:
                return stripped[: CHAT_SESSION_TITLE_MAX_LENGTH - 1] + "…"
            return stripped
    return "Untitled chat"


class ChatService:
    """Orchestrates `ChatRepository` with project-scoped access control."""

    def __init__(
        self,
        session: AsyncSession,
        chats: ChatRepository,
        projects: ProjectRepository,
    ) -> None:
        self._session = session
        self._chats = chats
        self._projects = projects

    async def _require_owned_project(
        self, owner_id: UUID, project_id: UUID,
    ) -> None:
        project = await self._projects.get_by_id(project_id)
        if project is None or project.owner_id != owner_id:
            raise ProjectNotFound(str(project_id))

    async def resolve_or_create_session(
        self,
        *,
        owner_id: UUID,
        project_id: UUID,
        session_id: UUID | None,
        user_query: str,
    ) -> ChatSession:
        """Return an owned session — existing or newly minted.
        """
        await self._require_owned_project(owner_id, project_id)

        if session_id is not None:
            row = await self._chats.get_session_with_owner(session_id)
            if row is None:
                raise ChatSessionNotFound(str(session_id))
            existing, existing_owner = row
            if existing_owner != owner_id or existing.project_id != project_id:
                raise ChatSessionNotFound(str(session_id))
            return existing

        new_session = ChatSession(
            project_id=project_id,
            title=_derive_title(user_query),
        )
        await self._chats.add_session(new_session)
        await self._session.commit()
        return new_session

    async def list_sessions(
        self,
        *,
        owner_id: UUID,
        project_id: UUID,
        limit: int,
        offset: int,
    ) -> list[ChatSession]:
        await self._require_owned_project(owner_id, project_id)
        return await self._chats.list_sessions_for_project(
            project_id, limit=limit, offset=offset,
        )

    async def get_session_for_owner(
        self, *, owner_id: UUID, session_id: UUID,
    ) -> ChatSession:
        """Return a session the caller owns, or raise 404.
        """
        row = await self._chats.get_session_with_owner(session_id)
        if row is None:
            raise ChatSessionNotFound(str(session_id))
        chat_session, owner = row
        if owner != owner_id:
            raise ChatSessionNotFound(str(session_id))
        return chat_session

    async def list_messages(
        self,
        *,
        owner_id: UUID,
        session_id: UUID,
        limit: int,
        offset: int,
    ) -> list[ChatMessage]:
        """Return the messages of a session the caller owns."""
        row = await self._chats.get_session_with_owner(session_id)
        if row is None:
            raise ChatSessionNotFound(str(session_id))
        _session, owner = row
        if owner != owner_id:
            raise ChatSessionNotFound(str(session_id))
        return await self._chats.list_messages_for_session(
            session_id, limit=limit, offset=offset,
        )

    async def rename_session(
        self,
        *,
        owner_id: UUID,
        session_id: UUID,
        title: str,
    ) -> ChatSession:
        """Rename a session the caller owns; raise `ChatSessionNotFound`
        for absent / not-mine cases.
        """
        row = await self._chats.get_session_with_owner(session_id)
        if row is None:
            raise ChatSessionNotFound(str(session_id))
        chat_session, owner = row
        if owner != owner_id:
            raise ChatSessionNotFound(str(session_id))
        await self._chats.update_title(chat_session, title)
        await self._session.commit()
        return chat_session

    async def delete_session(
        self,
        *,
        owner_id: UUID,
        session_id: UUID,
    ) -> None:
        """Idempotent delete. Absent OR not-owned → silent no-op.
        """
        row = await self._chats.get_session_with_owner(session_id)
        if row is None:
            return
        chat_session, owner = row
        if owner != owner_id:
            return
        await self._chats.delete_session(chat_session)
        await self._session.commit()

    async def persist_user_turn(
        self,
        *,
        session_id: UUID,
        content: str,
    ) -> ChatMessage:
        """Insert the user's message. Called BEFORE streaming begins
        so a stream that fails mid-flight still leaves a record of
        what was asked (useful for retries and analytics).
        """
        msg = ChatMessage(
            session_id=session_id,
            role="user",
            content=content,
            model=None,
            token_count=estimate_tokens(content),
        )
        await self._chats.add_message(msg)
        await self._session.commit()
        return msg

    async def persist_assistant_turn(
        self,
        *,
        session_id: UUID,
        content: str,
        model: str,
    ) -> ChatMessage:
        """Insert the assistant's reply. Called AFTER the stream's
        final `done` frame, with the accumulated text. Empty replies
        are still recorded — they are a meaningful event.
        """
        msg = ChatMessage(
            session_id=session_id,
            role="assistant",
            content=content,
            model=model,
            token_count=estimate_tokens(content),
        )
        await self._chats.add_message(msg)
        await self._session.commit()
        return msg
