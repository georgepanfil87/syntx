"""`ProjectRepository` — the only module that runs SQL against `projects`.
"""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.project import Project


class ProjectRepository:
    """Persistence operations for the `Project` aggregate."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_id(self, project_id: UUID) -> Project | None:
        return await self._session.get(Project, project_id)

    async def get_by_owner_and_name(self, owner_id: UUID, name: str) -> Project | None:
        """Pre-check for the `(owner_id, name)` unique constraint.
        """
        stmt = select(Project).where(
            Project.owner_id == owner_id,
            Project.name == name,
        )
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_for_owner(
        self,
        owner_id: UUID,
        *,
        limit: int,
        offset: int,
    ) -> list[Project]:
        """Return one page of an owner's projects, newest first.
        """
        stmt = (
            select(Project)
            .where(Project.owner_id == owner_id)
            .order_by(Project.created_at.desc(), Project.id.desc())
            .limit(limit)
            .offset(offset)
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def count_for_owner(self, owner_id: UUID) -> int:
        """Return the total number of projects for `owner_id`.
        """
        stmt = select(func.count()).select_from(Project).where(Project.owner_id == owner_id)
        result = await self._session.execute(stmt)
        return int(result.scalar_one())

    async def add(self, project: Project) -> Project:
        """Persist `project` in the current transaction.
        """
        self._session.add(project)
        await self._session.flush()
        return project

    async def delete(self, project: Project) -> None:
        """Schedule the row for deletion in the current transaction.
        """
        await self._session.delete(project)
        await self._session.flush()
