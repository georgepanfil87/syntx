"""`FileRepository` — the only module that runs SQL against `files`.
"""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.file import File


class FileRepository:
    """Persistence operations for the `File` aggregate."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list_for_project_tree(self, project_id: UUID) -> list[File]:
        """Return every file of `project_id` with content columns
        deferred out of the SELECT.
        """
        stmt = (
            select(
                File.id,
                File.project_id,
                File.path,
                File.size_bytes,
                File.created_at,
                File.updated_at,
            )
            .where(File.project_id == project_id)
            .order_by(File.path.asc())
        )
        rows = (await self._session.execute(stmt)).all()
        return [
            File(
                id=r.id,
                project_id=r.project_id,
                path=r.path,
                size_bytes=r.size_bytes,
                created_at=r.created_at,
                updated_at=r.updated_at,
                content="",
            )
            for r in rows
        ]

    async def get_by_project_and_path(
        self,
        project_id: UUID,
        path: str,
    ) -> File | None:
        """Load a single file row (with `content`) by its natural key.
        """
        stmt = select(File).where(
            File.project_id == project_id,
            File.path == path,
        )
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    async def add(self, file: File) -> File:
        """Persist a new file row in the current transaction.
        """
        self._session.add(file)
        await self._session.flush()
        return file

    async def update_content(self, file: File, content: str, size_bytes: int) -> File:
        """Apply a new body + size to an already-loaded file row.
        """
        file.content = content
        file.size_bytes = size_bytes
        await self._session.flush()
        await self._session.refresh(file, ["updated_at"])
        return file

    async def delete(self, file: File) -> None:
        """Remove the given file row in the current transaction."""
        await self._session.delete(file)
        await self._session.flush()
