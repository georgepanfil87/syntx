"""Users router — `/api/v1/users`.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.api.deps import get_current_user
from app.db.models.user import User
from app.schemas.user import UserRead

router = APIRouter(prefix="/users", tags=["users"])


@router.get(
    "/me",
    response_model=UserRead,
    summary="Return the authenticated user",
    responses={401: {"description": "Missing or invalid bearer token."}},
)
async def read_me(current_user: User = Depends(get_current_user)) -> UserRead:
    """Echo back the user the bearer token resolves to.
    """
    return UserRead.model_validate(current_user)
