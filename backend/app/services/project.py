"""`ProjectService` — business logic over the `Project` aggregate.
"""

from __future__ import annotations

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.project import Project
from app.repositories.project import ProjectRepository
from app.schemas.project import ProjectCreate, ProjectPage, ProjectRead, ProjectUpdate


class ProjectNameAlreadyTaken(Exception):
    """Raised when an owner already has a project with the requested name.
    """


class ProjectNotFound(Exception):
    """Raised when a project does not exist OR is not owned by the caller.
    """


class ProjectService:
    """Orchestrates `ProjectRepository` with ownership rules."""

    def __init__(self, session: AsyncSession, projects: ProjectRepository) -> None:
        self._session = session
        self._projects = projects

    async def create(self, owner_id: UUID, payload: ProjectCreate) -> Project:
        """Create a project owned by `owner_id`.
        """
        if await self._projects.get_by_owner_and_name(owner_id, payload.name) is not None:
            raise ProjectNameAlreadyTaken(payload.name)

        project = Project(
            owner_id=owner_id,
            name=payload.name,
            description=payload.description,
        )
        try:
            await self._projects.add(project)
            await self._session.commit()
        except Exception:
            await self._session.rollback()
            existing = await self._projects.get_by_owner_and_name(owner_id, payload.name)
            if existing is not None:
                raise ProjectNameAlreadyTaken(payload.name) from None
            raise
        return project

    async def _get_owned(self, project_id: UUID, owner_id: UUID) -> Project:
        """Fetch by id and assert ownership, raising `ProjectNotFound`
        for both "missing row" and "wrong owner".
        """
        project = await self._projects.get_by_id(project_id)
        if project is None or project.owner_id != owner_id:
            raise ProjectNotFound(str(project_id))
        return project

    async def get_for_owner(self, project_id: UUID, owner_id: UUID) -> Project:
        """Public version of `_get_owned` — used by the detail handler.

        Same uniform 404 mapping rule as the rest of the service.
        """
        return await self._get_owned(project_id, owner_id)

    async def update_for_owner(
        self,
        project_id: UUID,
        owner_id: UUID,
        payload: ProjectUpdate,
    ) -> Project:
        """Apply a partial update.
        """
        project = await self._get_owned(project_id, owner_id)
        data = payload.model_dump(exclude_unset=True)

        if "name" in data and data["name"] is not None and data["name"] != project.name:
            existing = await self._projects.get_by_owner_and_name(owner_id, data["name"])
            if existing is not None and existing.id != project.id:
                raise ProjectNameAlreadyTaken(data["name"])
            project.name = data["name"]

        if "description" in data:
            # `description: null` in the body clears the field; we treat
            # an absent key as "leave it alone".
            project.description = data["description"]

        try:
            await self._session.flush()
            await self._session.commit()
        except Exception:
            await self._session.rollback()
            if "name" in data and data["name"] is not None:
                existing = await self._projects.get_by_owner_and_name(owner_id, data["name"])
                if existing is not None and existing.id != project.id:
                    raise ProjectNameAlreadyTaken(data["name"]) from None
            raise

        await self._session.refresh(project)
        return project

    async def delete_for_owner(self, project_id: UUID, owner_id: UUID) -> None:
        """Delete a project owned by `owner_id`.
        """
        project = await self._get_owned(project_id, owner_id)
        try:
            await self._projects.delete(project)
            await self._session.commit()
        except Exception:
            await self._session.rollback()
            raise

    async def list_for_owner(
        self,
        owner_id: UUID,
        *,
        limit: int,
        offset: int,
    ) -> ProjectPage:
        """Return a paginated view of `owner_id`'s projects.
        """
        items = await self._projects.list_for_owner(owner_id, limit=limit, offset=offset)
        total = await self._projects.count_for_owner(owner_id)
        return ProjectPage(
            items=[ProjectRead.model_validate(p) for p in items],
            total=total,
            limit=limit,
            offset=offset,
        )
