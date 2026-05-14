"""Chat history router — `/api/v1`.
"""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.models.user import User
from app.db.session import get_session
from app.repositories.chat import ChatRepository
from app.repositories.project import ProjectRepository
from datetime import UTC, datetime

from app.schemas.chat import (
    ChatMessageList,
    ChatMessageRef,
    ChatSessionExport,
    ChatSessionList,
    ChatSessionRef,
    ChatSessionUpdate,
)
from app.services.chat import ChatService, ChatSessionNotFound
from app.services.project import ProjectNotFound

router = APIRouter(tags=["chat"])

_SESSION_NOT_FOUND = HTTPException(
    status_code=status.HTTP_404_NOT_FOUND, detail="chat session not found",
)
_PROJECT_NOT_FOUND = HTTPException(
    status_code=status.HTTP_404_NOT_FOUND, detail="project not found",
)


def get_chat_service(
    session: AsyncSession = Depends(get_session),
) -> ChatService:
    """Local factory mirroring the one in `ai.py`.
    """
    return ChatService(
        session=session,
        chats=ChatRepository(session),
        projects=ProjectRepository(session),
    )


@router.get(
    "/projects/{project_id}/chat/sessions",
    response_model=ChatSessionList,
    summary="List chat sessions for a project (newest first)",
    responses={
        401: {"description": "Missing or invalid bearer token."},
        404: {"description": "Project does not exist or is not yours."},
    },
)
async def list_sessions(
    project_id: UUID,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(get_current_user),
    chats: ChatService = Depends(get_chat_service),
) -> ChatSessionList:
    """Return the chat-session sidebar for a project.

    Pagination is offset-based: the sidebar is read top-to-bottom and
    the server already orders newest-first, so an offset model gives
    the simplest "load more" behaviour. Cursor pagination would be
    overkill for a list whose realistic upper bound is hundreds of
    rows per project.
    """
    try:
        sessions = await chats.list_sessions(
            owner_id=current_user.id,
            project_id=project_id,
            limit=limit,
            offset=offset,
        )
    except ProjectNotFound as exc:
        raise _PROJECT_NOT_FOUND from exc

    return ChatSessionList(
        items=[ChatSessionRef.model_validate(s) for s in sessions],
    )


@router.get(
    "/chat/sessions/{session_id}/messages",
    response_model=ChatMessageList,
    summary="Replay a chat session's messages (oldest first)",
    responses={
        401: {"description": "Missing or invalid bearer token."},
        404: {"description": "Session does not exist or is not yours."},
    },
)
async def list_messages(
    session_id: UUID,
    limit: int = Query(default=200, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(get_current_user),
    chats: ChatService = Depends(get_chat_service),
) -> ChatMessageList:
    """Return one page of a session's messages, oldest first.

    Default `limit=200` matches `CHAT_HISTORY_MAX_MESSAGES` so a
    typical session loads in one round-trip. Larger sessions paginate.
    """
    try:
        messages = await chats.list_messages(
            owner_id=current_user.id,
            session_id=session_id,
            limit=limit,
            offset=offset,
        )
    except ChatSessionNotFound as exc:
        raise _SESSION_NOT_FOUND from exc

    return ChatMessageList(
        items=[ChatMessageRef.model_validate(m) for m in messages],
    )


@router.patch(
    "/chat/sessions/{session_id}",
    response_model=ChatSessionRef,
    summary="Rename a chat session (sidebar title)",
    responses={
        401: {"description": "Missing or invalid bearer token."},
        404: {"description": "Session does not exist or is not yours."},
        422: {"description": "Body validation failed (blank / oversize title)."},
    },
)
async def rename_session(
    session_id: UUID,
    body: ChatSessionUpdate,
    current_user: User = Depends(get_current_user),
    chats: ChatService = Depends(get_chat_service),
) -> ChatSessionRef:
    """Update the sidebar title of a session the caller owns.

    Only `title` is accepted today — `project_id` is pinned for life
    and timestamps are server-managed. Additive fields extend this
    body later without breaking existing clients.
    """
    try:
        updated = await chats.rename_session(
            owner_id=current_user.id,
            session_id=session_id,
            title=body.title,
        )
    except ChatSessionNotFound as exc:
        raise _SESSION_NOT_FOUND from exc
    return ChatSessionRef.model_validate(updated)


@router.delete(
    "/chat/sessions/{session_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a chat session (and its messages, via CASCADE)",
    responses={
        204: {"description": "Session is gone (was-yours or never-existed both return here)."},
        401: {"description": "Missing or invalid bearer token."},
    },
)
async def delete_session(
    session_id: UUID,
    current_user: User = Depends(get_current_user),
    chats: ChatService = Depends(get_chat_service),
) -> Response:
    """Idempotent delete. Absent OR not-owned → silent `204`.

    CASCADE on the FK drops every `chat_messages` row in a single
    statement — no loop, no N+1, no half-deleted state.
    """
    await chats.delete_session(
        owner_id=current_user.id, session_id=session_id,
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


_EXPORT_MESSAGE_CAP = 10_000


@router.get(
    "/chat/sessions/{session_id}/export",
    response_model=ChatSessionExport,
    summary="Download a full JSON archive of a chat session",
    responses={
        200: {"description": "Complete session dump. Also served with a Content-Disposition attachment header."},
        401: {"description": "Missing or invalid bearer token."},
        404: {"description": "Session does not exist or is not yours."},
    },
)
async def export_session(
    session_id: UUID,
    current_user: User = Depends(get_current_user),
    chats: ChatService = Depends(get_chat_service),
) -> Response:
    """Assemble a versioned, self-contained JSON document of the session.
    """
    try:
        session_row = await chats.get_session_for_owner(
            owner_id=current_user.id, session_id=session_id,
        )
    except ChatSessionNotFound as exc:
        raise _SESSION_NOT_FOUND from exc

    messages = await chats.list_messages(
        owner_id=current_user.id,
        session_id=session_id,
        limit=_EXPORT_MESSAGE_CAP,
        offset=0,
    )

    payload = ChatSessionExport(
        session=ChatSessionRef.model_validate(session_row),
        messages=[ChatMessageRef.model_validate(m) for m in messages],
        exported_at=datetime.now(tz=UTC),
    )

    filename = f"syntx-chat-{session_id}.json"
    return Response(
        content=payload.model_dump_json(),
        media_type="application/json",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )
