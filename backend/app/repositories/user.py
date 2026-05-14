"""`UserRepository` — the only module that runs SQL against `users`.

Keeps SQLAlchemy specifics contained. Returns ORM entities (`User`) or
`None`; never raises for "not found" — that is a caller concern.
"""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.user import User


class UserRepository:
    """Persistence operations for the `User` aggregate.
    """

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_id(self, user_id: UUID) -> User | None:
        return await self._session.get(User, user_id)

    async def get_by_email(self, email: str) -> User | None:
        """Case-insensitive lookup — relies on the `CITEXT` column type."""
        stmt = select(User).where(User.email == email)
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    async def add(self, user: User) -> User:
        """Persist `user` in the current transaction and populate DB-side defaults.
        """
        self._session.add(user)
        await self._session.flush()
        return user
