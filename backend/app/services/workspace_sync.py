"""Materialize project files to disk + bidirectional sync with DB.
"""

from __future__ import annotations

import asyncio
import logging
import shutil
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from pathlib import Path
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.db.models.file import File, InvalidFilePath, normalize_path
from app.repositories.file import FileRepository

_logger = logging.getLogger(__name__)

# Per-project workspace dir. /tmp is ephemeral — on container restart
# the dirs vanish, which matches "terminal sessions don't survive
# restarts" anyway. Owned by the `syntx` user, not root.
WORKSPACE_ROOT = Path("/tmp/syntx-workspaces")

# How often the poll task scans disk for changes. Two seconds keeps
# latency tolerable for the user while keeping the DB write rate
# bounded even when somebody is heavily editing.
POLL_INTERVAL = 2.0

# Dirs we never traverse — populated by tools the user might run
# inside the terminal that produce huge file counts we don't want
# in the project's tree.
_SKIP_DIRS = frozenset({
    ".git",
    ".venv",
    "venv",
    "__pycache__",
    "node_modules",
    ".idea",
    ".vscode",
    ".pytest_cache",
    ".mypy_cache",
    "dist",
    "build",
    ".next",
    ".cache",
})

# Per-file size cap. Matches what the editor reasonably handles —
# bigger files (compiled binaries, large logs) are skipped to keep
# the DB lean and the embedding queue out of trouble.
_MAX_FILE_BYTES = 1 * 1024 * 1024


@dataclass(frozen=True, slots=True)
class WorkspaceContext:
    """Handle to a project's on-disk staging directory."""

    project_id: UUID
    root: Path


async def materialize(
    session: AsyncSession, project_id: UUID,
) -> WorkspaceContext:
    """Dump every project file to disk; return the workspace handle.

    Wipes any leftover directory first so the user always lands in a
    clean state matching the current DB content. Idempotent across
    repeated terminal opens.
    """
    root = WORKSPACE_ROOT / str(project_id)
    if root.exists():
        shutil.rmtree(root, ignore_errors=True)
    root.mkdir(parents=True, exist_ok=True)

    rows = (
        await session.execute(
            select(File).where(File.project_id == project_id)
        )
    ).scalars().all()

    for f in rows:
        # `f.path` was validated by `normalize_path` at upsert time
        # so it can't escape the workspace dir via `..` or absolute
        # prefixes. We re-resolve and assert containment anyway as
        # belt-and-suspenders.
        target = (root / f.path).resolve()
        try:
            target.relative_to(root.resolve())
        except ValueError:
            _logger.warning(
                "workspace-sync: refusing to write outside workspace: %s",
                f.path,
            )
            continue
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(f.content, encoding="utf-8")

    _logger.info(
        "workspace-sync: materialized %d files for project %s at %s",
        len(rows), project_id, root,
    )
    return WorkspaceContext(project_id=project_id, root=root)


def _scan_disk_files(root: Path) -> dict[str, str]:
    """Read every relevant file under `root`. Returns `{path: content}`.

    Skips known-irrelevant directories (see `_SKIP_DIRS`), binary
    files (non-UTF-8), and anything larger than `_MAX_FILE_BYTES`.
    """
    out: dict[str, str] = {}
    root_resolved = root.resolve()
    for entry in root.rglob("*"):
        if not entry.is_file():
            continue
        # Skip files under any blocklisted directory anywhere in
        # the path. We check by name rather than full path so a
        # tools dir at any depth is excluded.
        rel = entry.relative_to(root)
        parts = rel.parts
        if any(p in _SKIP_DIRS for p in parts[:-1]):
            continue
        if entry.stat().st_size > _MAX_FILE_BYTES:
            continue
        try:
            content = entry.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            # Binary file — can't store as text. Silent skip.
            continue
        # Re-validate the path against the project's contract before
        # we commit anything to the DB. Anything that fails (e.g.
        # backslash on Windows-style paths, control chars) is dropped.
        path_str = rel.as_posix()
        try:
            normalize_path(path_str)
        except InvalidFilePath:
            continue
        # Refuse anything that resolved outside the root (symlink
        # attacks). `entry.resolve()` follows symlinks; if the link
        # target escapes the workspace, skip.
        try:
            entry.resolve().relative_to(root_resolved)
        except ValueError:
            continue
        out[path_str] = content
    return out


@dataclass(slots=True)
class SyncCounts:
    """Per-iteration summary of what moved which way."""
    disk_to_db_upserts: int = 0
    disk_to_db_deletes: int = 0
    db_to_disk_writes: int = 0
    db_to_disk_deletes: int = 0

    @property
    def any_changes(self) -> bool:
        return (
            self.disk_to_db_upserts
            + self.disk_to_db_deletes
            + self.db_to_disk_writes
            + self.db_to_disk_deletes
        ) > 0


async def sync_two_way(
    session: AsyncSession,
    ctx: WorkspaceContext,
    last_synced: dict[str, str],
) -> SyncCounts:
    """Reconcile disk and DB. Mutates `last_synced` in place.

    `last_synced[path]` is the content we last KNEW was identical on
    both sides. It's the tiebreaker that tells us which side
    changed: if `disk_content == last_synced` but `db_content` differs,
    the change came from outside the terminal (Monaco). Conversely
    if `disk_content != last_synced`, the user edited via shell.

    Disk wins on simultaneous conflict — see module docstring.
    """
    db_rows = {
        f.path: f
        for f in (
            await session.execute(
                select(File).where(File.project_id == ctx.project_id)
            )
        ).scalars().all()
    }
    db_files = {p: f.content for p, f in db_rows.items()}
    disk_files = _scan_disk_files(ctx.root)

    repo = FileRepository(session)
    counts = SyncCounts()
    all_paths = set(db_files) | set(disk_files)

    for path in all_paths:
        disk_content = disk_files.get(path)
        db_content = db_files.get(path)
        last = last_synced.get(path)

        # Same on both sides — nothing to do, just refresh the marker.
        if disk_content == db_content:
            if disk_content is None:
                last_synced.pop(path, None)
            else:
                last_synced[path] = disk_content
            continue

        # Disk side has a file the DB doesn't know about.
        if disk_content is not None and db_content is None:
            new = File(
                project_id=ctx.project_id,
                path=path,
                content=disk_content,
                size_bytes=len(disk_content.encode("utf-8")),
            )
            await repo.add(new)
            counts.disk_to_db_upserts += 1
            last_synced[path] = disk_content
            continue

        # DB has a file the disk no longer has.
        if disk_content is None and db_content is not None:
            existing_orm = db_rows[path]
            # Did the terminal delete it, or has it just not been
            # materialized yet (e.g. the editor just created it
            # while the terminal session was active)?
            if last is not None:
                # We had it on disk before AND it's gone now — the
                # shell removed it (rm). Push the delete to DB.
                await repo.delete(existing_orm)
                counts.disk_to_db_deletes += 1
                last_synced.pop(path, None)
            else:
                # We never had it on disk for this session — the DB
                # acquired it externally (Monaco upsert). Push to
                # disk so the shell can see it.
                _write_disk_file(ctx.root, path, db_content)
                counts.db_to_disk_writes += 1
                last_synced[path] = db_content
            continue

        # Both sides have content; they disagree on what it is.
        assert disk_content is not None and db_content is not None
        if disk_content != last:
            # Disk diverged from our last marker → terminal edited.
            # Even if DB also diverged (Monaco simultaneously), the
            # terminal wins — the user is actively typing here.
            existing_orm = db_rows[path]
            await repo.update_content(
                existing_orm,
                disk_content,
                len(disk_content.encode("utf-8")),
            )
            counts.disk_to_db_upserts += 1
            last_synced[path] = disk_content
        else:
            # Disk hasn't changed since last sync. DB did — push
            # the DB version onto disk so the next `python foo.py`
            # picks up the latest Monaco edit.
            _write_disk_file(ctx.root, path, db_content)
            counts.db_to_disk_writes += 1
            last_synced[path] = db_content

    if counts.disk_to_db_upserts or counts.disk_to_db_deletes:
        await session.commit()

    if counts.any_changes:
        _logger.info(
            "workspace-sync: project %s — disk→db %d/%d, db→disk %d/%d",
            ctx.project_id,
            counts.disk_to_db_upserts,
            counts.disk_to_db_deletes,
            counts.db_to_disk_writes,
            counts.db_to_disk_deletes,
        )
    return counts


def _write_disk_file(root: Path, rel_path: str, content: str) -> None:
    """Safely write a file under the workspace dir.

    Resolves the target and re-checks containment so a stored path
    that somehow escaped validation can't write outside the dir.
    """
    target = (root / rel_path).resolve()
    try:
        target.relative_to(root.resolve())
    except ValueError:
        _logger.warning(
            "workspace-sync: refusing to write outside workspace: %s",
            rel_path,
        )
        return
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")


# Back-compat shim: `sync_disk_to_db` is still imported by the
# terminal route's final-flush code path. Routes the call through
# the new two-way function with a fresh ledger (so a final sync at
# disconnect captures any last-second disk changes that the periodic
# loop didn't catch — DB→disk during final flush is irrelevant
# because the user has already disconnected).
async def sync_disk_to_db(
    session: AsyncSession,
    ctx: WorkspaceContext,
) -> tuple[int, int]:
    """Compatibility wrapper. Prefer `sync_two_way` for new code."""
    counts = await sync_two_way(session, ctx, last_synced={})
    return counts.disk_to_db_upserts, counts.disk_to_db_deletes


async def sync_loop(
    session_factory: async_sessionmaker[AsyncSession]
    | Callable[[], AsyncSession],
    ctx: WorkspaceContext,
    stop_event: asyncio.Event,
    on_change: Callable[[], Awaitable[None]] | None = None,
) -> None:
    """Poll the workspace dir until `stop_event` is set.

    Maintains a per-loop `last_synced` ledger so subsequent
    iterations can tell disk-side changes apart from DB-side
    changes. The ledger is seeded from the disk state at startup —
    those files were materialized from the DB just before the loop
    started, so they're definitionally in-sync at T=0.

    Each iteration opens its own short-lived session. We can't share
    the WS handler's session because the handler holds it for the
    whole connection lifetime. Errors are logged but don't break
    the loop — a transient DB hiccup shouldn't kill sync for the
    rest of the session.

    `on_change` is invoked (once per iteration, after the commit)
    whenever the iteration produced at least one change in either
    direction. The terminal endpoint uses it to push a
    `files_changed` event over the same WebSocket the user is
    typing into so the frontend can refresh its file tree.
    """
    # Seed the ledger from whatever the materializer just wrote.
    # Anything present on disk at T=0 matches the DB, so it's safe
    # to record current content as the "last known synced" version.
    last_synced: dict[str, str] = _scan_disk_files(ctx.root)

    while not stop_event.is_set():
        try:
            await asyncio.wait_for(stop_event.wait(), timeout=POLL_INTERVAL)
            return  # stop was signalled
        except asyncio.TimeoutError:
            pass
        try:
            async with session_factory() as session:
                counts = await sync_two_way(session, ctx, last_synced)
            if counts.any_changes and on_change is not None:
                try:
                    await on_change()
                except Exception as exc:
                    # The callback is "best effort" notification; a
                    # failure to push the WS frame must not abort
                    # the sync loop. Log + carry on.
                    _logger.warning(
                        "workspace-sync: on_change callback failed: %s", exc,
                    )
        except Exception as exc:
            _logger.warning(
                "workspace-sync: poll failed for project %s: %s",
                ctx.project_id, exc,
            )
