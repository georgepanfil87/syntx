"""`UserService` — business logic over the `User` aggregate.
"""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password, verify_password
from app.db.models.user import User
from app.repositories.user import UserRepository
from app.schemas.user import UserCreate, UserLogin

# Precomputed once at import time. The plaintext is irrelevant — this hash
# is never a valid password anywhere; it exists only to give
# `verify_password` something bcrypt-shaped to chew on when the email does
# not resolve to a user. Computing a fresh hash per failed login would be
# wasteful and still expose timing via the variance of `gensalt`.
_DUMMY_HASH = hash_password("dummy-password-for-constant-time-auth")


class EmailAlreadyTaken(Exception):
    """Raised when registration attempts an email that is already in use."""


class InvalidCredentials(Exception):
    """Raised when login email/password pair does not match an active user.
    """


class InactiveAccount(Exception):
    """Raised when the matched user exists but `is_active` is False.
    """


class UserService:
    """Orchestrates the `UserRepository` with auth primitives.
    """

    def __init__(self, session: AsyncSession, users: UserRepository) -> None:
        self._session = session
        self._users = users

    async def register(self, payload: UserCreate) -> User:
        """Create a new `User` from a validated `UserCreate` payload.
        """
        if await self._users.get_by_email(payload.email) is not None:
            raise EmailAlreadyTaken(payload.email)

        user = User(
            email=payload.email,
            password_hash=hash_password(payload.password.get_secret_value()),
        )
        try:
            await self._users.add(user)
            await self._session.commit()
        except Exception:
            await self._session.rollback()
            # Re-check: a concurrent insert may have beaten us to the unique
            # constraint. Treat as the same domain error the pre-check raises.
            existing = await self._users.get_by_email(payload.email)
            if existing is not None:
                raise EmailAlreadyTaken(payload.email) from None
            raise
        return user

    async def authenticate(self, payload: UserLogin) -> User:
        """Return the `User` matching `payload`, or raise.
        """
        plaintext = payload.password.get_secret_value()
        user = await self._users.get_by_email(payload.email)

        if user is None:
            # Run a dummy verify to normalize timing. The result is
            # discarded; the outcome here is always "invalid".
            verify_password(plaintext, _DUMMY_HASH)
            raise InvalidCredentials()

        if not verify_password(plaintext, user.password_hash):
            raise InvalidCredentials()

        if not user.is_active:
            raise InactiveAccount()

        return user
