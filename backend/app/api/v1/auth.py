"""Authentication router — `/api/v1/auth`.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import SecretStr
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.core.security import create_access_token
from app.db.session import get_session
from app.repositories.user import UserRepository
from app.schemas.auth import TokenRead
from app.schemas.user import UserCreate, UserLogin, UserRead
from app.services.user import (
    EmailAlreadyTaken,
    InactiveAccount,
    InvalidCredentials,
    UserService,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def get_user_service(session: AsyncSession = Depends(get_session)) -> UserService:
    """Assemble a `UserService` for the request-scoped session.
    """
    return UserService(session, UserRepository(session))


@router.post(
    "/register",
    response_model=UserRead,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user",
    responses={409: {"description": "Email already registered."}},
)
async def register(
    body: UserCreate,
    service: UserService = Depends(get_user_service),
) -> UserRead:
    try:
        user = await service.register(body)
    except EmailAlreadyTaken as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="email already registered",
        ) from exc
    return UserRead.model_validate(user)


_LOGIN_FAILED = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="invalid email or password",
    headers={"WWW-Authenticate": "Bearer"},
)


@router.post(
    "/login",
    response_model=TokenRead,
    summary="Exchange credentials for a bearer token",
    responses={401: {"description": "Invalid credentials or inactive account."}},
)
async def login(
    body: UserLogin,
    service: UserService = Depends(get_user_service),
    settings: Settings = Depends(get_settings),
) -> TokenRead:
    """Issue a short-lived JWT for the given credentials.
    """
    try:
        user = await service.authenticate(body)
    except (InvalidCredentials, InactiveAccount) as exc:
        raise _LOGIN_FAILED from exc

    token = create_access_token(subject=str(user.id))
    return TokenRead(
        access_token=token,
        expires_in=settings.jwt_access_ttl_minutes * 60,
    )


@router.post(
    "/token",
    response_model=TokenRead,
    summary="OAuth2 password-flow token endpoint (for Swagger Authorize)",
    responses={401: {"description": "Invalid credentials or inactive account."}},
)
async def token(
    form: OAuth2PasswordRequestForm = Depends(),
    service: UserService = Depends(get_user_service),
    settings: Settings = Depends(get_settings),
) -> TokenRead:
    """OAuth2 password-grant shape (`application/x-www-form-urlencoded`).
    """
    credentials = UserLogin(email=form.username, password=SecretStr(form.password))
    try:
        user = await service.authenticate(credentials)
    except (InvalidCredentials, InactiveAccount) as exc:
        raise _LOGIN_FAILED from exc

    access = create_access_token(subject=str(user.id))
    return TokenRead(
        access_token=access,
        expires_in=settings.jwt_access_ttl_minutes * 60,
    )
