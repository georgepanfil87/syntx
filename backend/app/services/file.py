"""`FileService` — business logic over the `File` aggregate.
"""

from __future__ import annotations

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.file import File
from app.repositories.file import FileRepository
from app.repositories.project import ProjectRepository
from app.schemas.file import FileTree, FileTreeEntry, FileUpsert
from app.services.project import ProjectNotFound


class FileNotFound(Exception):
    """Raised by `get_file_for_owner` when the path does not exist in a
    project the caller owns.
    """


def _utf8_size(content: str) -> int:
    """Byte length of `content` as UTF-8. Isolated so the repository
    and any future caller (diffing, LLM token budgeting) compute sizes
    identically."""
    return len(content.encode("utf-8"))


class FileService:
    """Orchestrates `FileRepository` with project-scoped access control."""

    def __init__(
        self,
        session: AsyncSession,
        files: FileRepository,
        projects: ProjectRepository,
    ) -> None:
        self._session = session
        self._files = files
        self._projects = projects

    async def _require_owned_project(self, owner_id: UUID, project_id: UUID) -> None:
        """Raise `ProjectNotFound` unless `project_id` exists AND belongs
        to `owner_id`. One exception covers both cases so the handler
        cannot accidentally distinguish them in the response.
        """
        project = await self._projects.get_by_id(project_id)
        if project is None or project.owner_id != owner_id:
            raise ProjectNotFound(str(project_id))

    async def tree_for_owner(self, owner_id: UUID, project_id: UUID) -> FileTree:
        """Return the project's file tree (metadata only)."""
        await self._require_owned_project(owner_id, project_id)
        rows: list[File] = await self._files.list_for_project_tree(project_id)
        return FileTree(
            project_id=project_id,
            items=[FileTreeEntry.model_validate(f) for f in rows],
        )

    async def get_file_for_owner(
        self,
        owner_id: UUID,
        project_id: UUID,
        path: str,
    ) -> File:
        """Return a single file (with `content`) if it exists under a
        project the caller owns."""
        await self._require_owned_project(owner_id, project_id)
        file = await self._files.get_by_project_and_path(project_id, path)
        if file is None:
            raise FileNotFound(path)
        return file

    async def upsert_file(
        self,
        owner_id: UUID,
        project_id: UUID,
        path: str,
        payload: FileUpsert,
    ) -> tuple[File, bool]:
        """Create or replace a file at `path`. Returns `(file, created)`.

        `created` is True on insert, False on update — the handler uses
        it to pick `201 Created` vs `200 OK`.

        The check-then-write race is bounded by the unique constraint
        `uq_files_project_id_path`: a concurrent insert that beats us
        turns our `add()` into an `IntegrityError`, which we resolve by
        re-loading the row and applying the update instead. The user's
        last write wins — a deliberate choice matching the single-user-
        workspace model. Multi-writer conflict resolution (ETag /
        `If-Match`) is a separate step.
        """
        await self._require_owned_project(owner_id, project_id)

        size_bytes = _utf8_size(payload.content)
        existing = await self._files.get_by_project_and_path(project_id, path)

        if existing is not None:
            await self._files.update_content(existing, payload.content, size_bytes)
            await self._session.commit()
            return existing, False

        new_file = File(
            project_id=project_id,
            path=path,
            content=payload.content,
            size_bytes=size_bytes,
        )
        try:
            await self._files.add(new_file)
            await self._session.commit()
        except Exception:
            await self._session.rollback()
            # Concurrent insert won the race. Fall back to update on the
            # row that now exists. If it still isn't there, the failure
            # was something else — re-raise.
            existing = await self._files.get_by_project_and_path(project_id, path)
            if existing is None:
                raise
            await self._files.update_content(existing, payload.content, size_bytes)
            await self._session.commit()
            return existing, False

        return new_file, True

    async def delete_file(
        self,
        owner_id: UUID,
        project_id: UUID,
        path: str,
    ) -> None:
        """Idempotent delete. Absent file → no-op, no error.

        Rationale in `app/api/v1/files.py`: DELETE is idempotent per
        HTTP conventions; reporting 404 for "already deleted" breaks
        retry-safe semantics clients rely on.
        """
        await self._require_owned_project(owner_id, project_id)
        existing = await self._files.get_by_project_and_path(project_id, path)
        if existing is None:
            return
        await self._files.delete(existing)
        await self._session.commit()
