"""Project version-control service — DB-backed snapshots.
"""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.file import File
from app.db.models.snapshot import ProjectSnapshot, SnapshotFile
from app.repositories.project import ProjectRepository
from app.services.project import ProjectNotFound


class CommitNotFound(Exception):
    """Raised when a commit id doesn't exist (or isn't in this project)."""


class GitService:
    def __init__(
        self,
        session: AsyncSession,
        projects: ProjectRepository,
    ) -> None:
        self._session = session
        self._projects = projects

    # Ownership guard, shared by every public method

    async def _require_owned_project(
        self, owner_id: UUID, project_id: UUID,
    ) -> None:
        project = await self._projects.get_by_id(project_id)
        if project is None or project.owner_id != owner_id:
            raise ProjectNotFound(str(project_id))

    # Commit

    async def commit(
        self,
        *,
        owner_id: UUID,
        project_id: UUID,
        author_id: UUID,
        message: str,
    ) -> ProjectSnapshot:
        """Create a new commit by snapshotting every current file.
        """
        await self._require_owned_project(owner_id, project_id)

        files: list[File] = (
            await self._session.execute(
                select(File).where(File.project_id == project_id)
            )
        ).scalars().all()

        snapshot = ProjectSnapshot(
            project_id=project_id,
            author_id=author_id,
            message=message.strip(),
            file_count=len(files),
        )
        self._session.add(snapshot)
        await self._session.flush()  # need snapshot.id for FK below

        for f in files:
            self._session.add(
                SnapshotFile(
                    snapshot_id=snapshot.id,
                    path=f.path,
                    content=f.content,
                    size_bytes=f.size_bytes,
                )
            )

        await self._session.commit()
        return snapshot

    # Log

    async def log(
        self,
        *,
        owner_id: UUID,
        project_id: UUID,
        limit: int = 50,
    ) -> list[ProjectSnapshot]:
        await self._require_owned_project(owner_id, project_id)
        return (
            await self._session.execute(
                select(ProjectSnapshot)
                .where(ProjectSnapshot.project_id == project_id)
                .order_by(desc(ProjectSnapshot.created_at))
                .limit(limit)
            )
        ).scalars().all()

    # Status

    async def status(
        self,
        *,
        owner_id: UUID,
        project_id: UUID,
    ) -> tuple[int, ProjectSnapshot | None, list[tuple[str, str]]]:
        """Return (`commit_count`, `last_snapshot`, `[(path, change)]`).

        `change` is one of "added" / "modified" / "deleted":
          - added    file exists now but not in last snapshot
          - modified file exists in both but content differs
          - deleted  file was in last snapshot but no longer exists
        """
        await self._require_owned_project(owner_id, project_id)

        # Count + fetch latest snapshot in one round trip per concern.
        latest: ProjectSnapshot | None = (
            await self._session.execute(
                select(ProjectSnapshot)
                .where(ProjectSnapshot.project_id == project_id)
                .order_by(desc(ProjectSnapshot.created_at))
                .limit(1)
            )
        ).scalar_one_or_none()

        count = (
            await self._session.execute(
                select(ProjectSnapshot.id).where(
                    ProjectSnapshot.project_id == project_id,
                )
            )
        ).scalars().all()
        commit_count = len(count)

        # Current files
        current: dict[str, str] = {
            row.path: row.content
            for row in (
                await self._session.execute(
                    select(File).where(File.project_id == project_id)
                )
            ).scalars().all()
        }

        if latest is None:
            # No history yet — every current file counts as "added"
            # relative to the imaginary empty initial state.
            changes = [(path, "added") for path in sorted(current.keys())]
            return commit_count, None, changes

        snap_files: dict[str, str] = {
            row.path: row.content
            for row in (
                await self._session.execute(
                    select(SnapshotFile).where(
                        SnapshotFile.snapshot_id == latest.id,
                    )
                )
            ).scalars().all()
        }

        changes: list[tuple[str, str]] = []
        for path, content in current.items():
            if path not in snap_files:
                changes.append((path, "added"))
            elif snap_files[path] != content:
                changes.append((path, "modified"))
        for path in snap_files:
            if path not in current:
                changes.append((path, "deleted"))
        changes.sort(key=lambda kv: kv[0])
        return commit_count, latest, changes

    # Diff

    async def diff(
        self,
        *,
        owner_id: UUID,
        project_id: UUID,
        commit_id: UUID,
        path: str,
    ) -> tuple[str, str]:
        """Return `(before, after)` for one path at a chosen commit.

        `before` is the content as captured in the commit (empty when
        the file was added there). `after` is the live content (empty
        when the file has since been deleted). Either or both can be
        empty strings — the diff editor handles that gracefully.
        """
        await self._require_owned_project(owner_id, project_id)

        snapshot: ProjectSnapshot | None = (
            await self._session.execute(
                select(ProjectSnapshot).where(
                    ProjectSnapshot.id == commit_id,
                    ProjectSnapshot.project_id == project_id,
                )
            )
        ).scalar_one_or_none()
        if snapshot is None:
            raise CommitNotFound(str(commit_id))

        before_row = (
            await self._session.execute(
                select(SnapshotFile).where(
                    SnapshotFile.snapshot_id == commit_id,
                    SnapshotFile.path == path,
                )
            )
        ).scalar_one_or_none()
        before = before_row.content if before_row else ""

        after_row = (
            await self._session.execute(
                select(File).where(
                    File.project_id == project_id,
                    File.path == path,
                )
            )
        ).scalar_one_or_none()
        after = after_row.content if after_row else ""

        return before, after

    # Commit detail

    async def get_commit(
        self,
        *,
        owner_id: UUID,
        project_id: UUID,
        commit_id: UUID,
    ) -> tuple[ProjectSnapshot, list[SnapshotFile]]:
        """Return a commit + its captured file list (no content)."""
        await self._require_owned_project(owner_id, project_id)

        snapshot: ProjectSnapshot | None = (
            await self._session.execute(
                select(ProjectSnapshot).where(
                    ProjectSnapshot.id == commit_id,
                    ProjectSnapshot.project_id == project_id,
                )
            )
        ).scalar_one_or_none()
        if snapshot is None:
            raise CommitNotFound(str(commit_id))

        files = (
            await self._session.execute(
                select(SnapshotFile)
                .where(SnapshotFile.snapshot_id == commit_id)
                .order_by(SnapshotFile.path)
            )
        ).scalars().all()
        return snapshot, files
