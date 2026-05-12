"""Project import/export — ZIP-backed portable bundles.
"""

from __future__ import annotations

import io
import json
import logging
import zipfile
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.file import File, InvalidFilePath, normalize_path
from app.db.models.project import Project
from app.repositories.file import FileRepository
from app.repositories.project import ProjectRepository
from app.services.project import (
    ProjectNameAlreadyTaken,
    ProjectNotFound,
    ProjectService,
)

_logger = logging.getLogger(__name__)

MANIFEST_NAME = "syntx-manifest.json"
FILES_PREFIX = "files/"
MANIFEST_VERSION = "1"
# Generous cap so a runaway import can't OOM the server. 50 MB is
# plenty for a code-only project (no binaries embedded — paths are
# subject to the same normalize_path rules as live editing).
MAX_IMPORT_SIZE_BYTES = 50 * 1024 * 1024
# Per-file cap. Matches what the editor reasonably handles.
MAX_FILE_BYTES = 4 * 1024 * 1024


class ImportError_(Exception):
    """Raised when a ZIP can't be turned into a project.
    """


class ExportImportService:
    """Bundles + unbundles a project as a single ZIP blob.
    """

    def __init__(
        self,
        session: AsyncSession,
        projects: ProjectRepository,
        files: FileRepository,
        project_service: ProjectService,
    ) -> None:
        self._session = session
        self._projects = projects
        self._files = files
        self._project_service = project_service

    # Export

    async def export_project(
        self,
        *,
        owner_id: UUID,
        project_id: UUID,
    ) -> tuple[bytes, str]:
        """Return `(zip_bytes, filename)` for the project's contents.

        """
        project = await self._projects.get_by_id(project_id)
        if project is None or project.owner_id != owner_id:
            raise ProjectNotFound(str(project_id))

        files: list[File] = (
            await self._session.execute(
                select(File).where(File.project_id == project_id)
            )
        ).scalars().all()

        manifest = {
            "syntx_version": MANIFEST_VERSION,
            "name": project.name,
            "description": project.description,
            "exported_at": datetime.now(timezone.utc).isoformat(),
            "file_count": len(files),
            "files": [{"path": f.path, "size_bytes": f.size_bytes} for f in files],
        }

        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
            zf.writestr(
                MANIFEST_NAME,
                json.dumps(manifest, indent=2, ensure_ascii=False),
            )
            for f in files:
                zf.writestr(f"{FILES_PREFIX}{f.path}", f.content)
        slug = "".join(c if c.isalnum() or c in "-._" else "-" for c in project.name).strip("-")
        filename = f"{slug or 'project'}.syntx.zip"
        return buf.getvalue(), filename

    # Import

    async def import_project(
        self,
        *,
        owner_id: UUID,
        zip_bytes: bytes,
    ) -> Project:
        """Materialise a ZIP into a new project owned by `owner_id`.
        """
        if len(zip_bytes) > MAX_IMPORT_SIZE_BYTES:
            raise ImportError_(
                f"archive too large ({len(zip_bytes)} bytes > "
                f"{MAX_IMPORT_SIZE_BYTES})"
            )

        try:
            zf = zipfile.ZipFile(io.BytesIO(zip_bytes))
        except zipfile.BadZipFile as exc:
            raise ImportError_(f"not a valid ZIP archive: {exc}") from exc

        # Parse manifest first so we know what we're committing to.
        if MANIFEST_NAME not in zf.namelist():
            raise ImportError_(f"missing {MANIFEST_NAME} in archive root")
        try:
            manifest = json.loads(zf.read(MANIFEST_NAME))
        except json.JSONDecodeError as exc:
            raise ImportError_(f"{MANIFEST_NAME} is not valid JSON: {exc}") from exc

        version = manifest.get("syntx_version")
        if version != MANIFEST_VERSION:
            raise ImportError_(
                f"unsupported manifest version {version!r}; "
                f"this server understands {MANIFEST_VERSION!r}"
            )

        name = manifest.get("name")
        if not isinstance(name, str) or not name.strip():
            raise ImportError_("manifest.name is missing or empty")
        description = manifest.get("description")
        if description is not None and not isinstance(description, str):
            raise ImportError_("manifest.description must be a string or null")

        # Resolve a non-conflicting name on this user's account.
        unique_name = await self._pick_unique_name(owner_id, name.strip())

        # Create the project first — gives us a `project_id` to hang
        # files off. Done via the service so the standard creation
        # rules (validation, repo update) apply.
        from app.schemas.project import ProjectCreate

        project = await self._project_service.create(
            owner_id=owner_id,
            payload=ProjectCreate(name=unique_name, description=description),
        )

        # Insert every file under `files/` into the new project.
        # Path is taken from the ZIP entry name (stripped of prefix),
        # not from the manifest — the manifest is informational only,
        # the source of truth is what's actually in the archive.
        for entry in zf.namelist():
            if entry == MANIFEST_NAME:
                continue
            if not entry.startswith(FILES_PREFIX):
                # Silently ignore anything outside the files/ tree.
                # Future formats might add sidecar data (chats,
                # metadata); ignoring keeps forward-compat.
                continue
            relative = entry[len(FILES_PREFIX):]
            if not relative or entry.endswith("/"):
                # Directory entries — skip.
                continue
            try:
                relative = normalize_path(relative)
            except InvalidFilePath as exc:
                # Hard fail — refuse the whole import. A bad path is
                # almost certainly a tampered archive.
                await self._session.rollback()
                raise ImportError_(
                    f"file entry {entry!r} has an invalid path: {exc}"
                ) from exc

            info = zf.getinfo(entry)
            if info.file_size > MAX_FILE_BYTES:
                await self._session.rollback()
                raise ImportError_(
                    f"file {relative!r} exceeds per-file cap "
                    f"({info.file_size} > {MAX_FILE_BYTES})"
                )

            raw = zf.read(entry)
            # Stored as UTF-8 text — same contract as live editing.
            # We don't try to support binary; the editor doesn't
            # render them, and embeddings would be garbage anyway.
            try:
                content = raw.decode("utf-8")
            except UnicodeDecodeError as exc:
                await self._session.rollback()
                raise ImportError_(
                    f"file {relative!r} is not valid UTF-8: {exc}"
                ) from exc

            new_file = File(
                project_id=project.id,
                path=relative,
                content=content,
                size_bytes=len(content.encode("utf-8")),
            )
            await self._files.add(new_file)

        await self._session.commit()
        return project

    async def _pick_unique_name(self, owner_id: UUID, base: str) -> str:
        """Find a name that doesn't collide with the user's existing
        projects. Appends " (imported)", then " (imported N)" if also taken.
        """
        if await self._projects.get_by_owner_and_name(owner_id, base) is None:
            return base
        candidate = f"{base} (imported)"
        if await self._projects.get_by_owner_and_name(owner_id, candidate) is None:
            return candidate
        for i in range(2, 50):
            candidate = f"{base} (imported {i})"
            if await self._projects.get_by_owner_and_name(owner_id, candidate) is None:
                return candidate
        raise ProjectNameAlreadyTaken(base)
