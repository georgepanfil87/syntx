"""Integrated terminal — WebSocket + PTY.
"""

from __future__ import annotations

import asyncio
import fcntl
import json
import logging
import os
import pty
import shutil
import signal
import struct
import termios
from uuid import UUID

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import InvalidTokenError, decode_access_token
from app.db.session import SessionLocal
from app.repositories.project import ProjectRepository
from app.repositories.user import UserRepository
from app.services.workspace_sync import (
    WorkspaceContext,
    materialize,
    sync_disk_to_db,
    sync_loop,
)

_logger = logging.getLogger(__name__)

# Single chunk size for PTY reads. 4 KB is a comfortable trade-off:
# big enough that high-bandwidth output (long `find`, log tails)
# doesn't get sliced into tiny WS frames, small enough that the
# event loop stays responsive between reads.
_PTY_READ_CHUNK = 4096

router = APIRouter(prefix="/projects/{project_id}", tags=["terminal"])


@router.websocket("/terminal")
async def terminal_socket(
    websocket: WebSocket,
    project_id: UUID,
    token: str = Query(..., description="JWT access token"),
) -> None:
    # Auth
    # Validate the token + project ownership BEFORE accepting the
    # socket. WebSocket close codes don't carry an HTTP body, so a
    # 4401 / 4404 numeric code is the most we can hand back.
    async with SessionLocal() as session:
        ok = await _authorise(token, project_id, session)
    if not ok:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await websocket.accept()

    # Materialize project files to disk
    # Hydrate the workspace tempdir from the DB so `ls`, `cat`,
    # `python foo.py` work against real files. A background poll
    # syncs disk changes back so anything the user creates / edits
    # in the shell ends up in the project tree.
    try:
        async with SessionLocal() as session:
            ws_ctx: WorkspaceContext = await materialize(session, project_id)
    except Exception as exc:
        _logger.exception("terminal: workspace materialize failed")
        await _send_safe(
            websocket,
            {"type": "output", "data": f"workspace setup failed: {exc}\r\n"},
        )
        await websocket.close(code=status.WS_1011_INTERNAL_ERROR)
        return

    # Spawn the PTY
    shell = shutil.which("bash") or shutil.which("sh") or "/bin/sh"
    try:
        child_pid, master_fd = pty.fork()
    except OSError as exc:
        _logger.exception("terminal: pty.fork failed")
        await _send_safe(websocket, {"type": "exit", "code": -1})
        await websocket.close(code=status.WS_1011_INTERNAL_ERROR)
        return

    if child_pid == 0:
        try:
            os.chdir(str(ws_ctx.root))
        except OSError:
            pass
        env = {
            "TERM": "xterm-256color",
            "LANG": os.environ.get("LANG", "C.UTF-8"),
            "PATH": os.environ.get(
                "PATH", "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
            ),
            "PS1": "syntx:\\W$ ",
            "HOME": str(ws_ctx.root),
        }
        try:
            os.execvpe(shell, [shell, "-i"], env)
        except Exception:  # pragma: no cover — only reachable if exec fails
            os._exit(127)

    # Parent: bidirectional pipe
    # Set the master fd non-blocking so reads don't stall the loop
    # if the child has nothing to say.
    flags = fcntl.fcntl(master_fd, fcntl.F_GETFL)
    fcntl.fcntl(master_fd, fcntl.F_SETFL, flags | os.O_NONBLOCK)

    loop = asyncio.get_running_loop()
    disconnect_event = asyncio.Event()

    def on_readable() -> None:
        """Drain whatever the PTY has, schedule the WS send.
        """
        try:
            data = os.read(master_fd, _PTY_READ_CHUNK)
        except BlockingIOError:
            return
        except OSError:
            disconnect_event.set()
            return
        if not data:
            disconnect_event.set()
            return
        # `errors='replace'` so a stray non-UTF8 byte (e.g. a tab
        # completion of a binary file name) doesn't kill the loop.
        asyncio.create_task(
            _send_safe(
                websocket,
                {"type": "output", "data": data.decode("utf-8", "replace")},
            )
        )

    loop.add_reader(master_fd, on_readable)

    async def consume_client() -> None:
        """Forward client → PTY until the WebSocket closes."""
        while not disconnect_event.is_set():
            try:
                raw = await websocket.receive_text()
            except WebSocketDisconnect:
                return
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                # Ignore malformed frames; logging would spam if the
                # client misbehaves. The protocol is small enough
                # that fuzzed input from a confused frontend is the
                # only realistic source.
                continue
            kind = msg.get("type")
            if kind == "input":
                payload = msg.get("data", "")
                if isinstance(payload, str):
                    try:
                        os.write(master_fd, payload.encode("utf-8"))
                    except OSError:
                        return
            elif kind == "resize":
                cols = int(msg.get("cols") or 80)
                rows = int(msg.get("rows") or 24)
                # TIOCSWINSZ takes (rows, cols, xpix, ypix). The
                # last two are vestigial — modern terminals ignore
                # them. Bash uses the new size on the next prompt.
                try:
                    fcntl.ioctl(
                        master_fd,
                        termios.TIOCSWINSZ,
                        struct.pack("HHHH", rows, cols, 0, 0),
                    )
                except OSError:
                    pass
            # Unknown types are silently dropped — forward-compat for
            # future protocol additions without an error round trip.

    # Background disk → DB sync loop
    # Started right after the PTY is up so any file the user
    # creates / edits in the shell flows back into the project
    # tree within a few seconds. Cancelled in the finally block.
    #
    # The on_change callback rides the existing terminal WS — a
    # tiny `files_changed` JSON frame the client uses as a cue to
    # re-fetch the file tree. Lets us avoid frontend polling.
    sync_stop = asyncio.Event()

    async def notify_files_changed() -> None:
        await _send_safe(websocket, {"type": "files_changed"})

    sync_task = asyncio.create_task(
        sync_loop(SessionLocal, ws_ctx, sync_stop, notify_files_changed)
    )

    consumer = asyncio.create_task(consume_client())
    disconnect_waiter = asyncio.create_task(disconnect_event.wait())
    try:
        await asyncio.wait(
            {consumer, disconnect_waiter},
            return_when=asyncio.FIRST_COMPLETED,
        )
    finally:
        # Tear everything down in a fixed order: stop reading the
        # PTY, signal the shell, reap the child, run a final sync,
        # close the WS. Skip-on-error throughout — by the time we
        # get here at least one side has already failed, and
        # there's nothing actionable to do with a second exception.
        try:
            loop.remove_reader(master_fd)
        except Exception:
            pass
        consumer.cancel()
        disconnect_waiter.cancel()
        sync_stop.set()
        try:
            os.kill(child_pid, signal.SIGHUP)
        except ProcessLookupError:
            pass
        try:
            os.close(master_fd)
        except OSError:
            pass
        # Best-effort final sync so the very last keystrokes the
        # user made (after the previous poll, before disconnect)
        # don't get lost. Capped at 10s — if the DB is wedged we'd
        # rather drop the tail than hang the WS teardown.
        try:
            await asyncio.wait_for(sync_task, timeout=2.0)
        except (asyncio.TimeoutError, Exception):
            sync_task.cancel()
        try:
            async with SessionLocal() as session:
                await asyncio.wait_for(
                    sync_disk_to_db(session, ws_ctx), timeout=10.0,
                )
        except Exception:
            _logger.warning(
                "terminal: final workspace sync failed for project %s",
                project_id,
            )
        # Best-effort reap so we don't leak zombies; nonblocking
        # so a slow-dying shell doesn't hold the loop.
        try:
            os.waitpid(child_pid, os.WNOHANG)
        except ChildProcessError:
            pass
        try:
            await _send_safe(websocket, {"type": "exit", "code": 0})
        except Exception:
            pass
        try:
            await websocket.close()
        except Exception:
            pass


async def _authorise(
    token: str,
    project_id: UUID,
    session: AsyncSession,
) -> bool:
    """Validate token + project ownership in one place."""
    try:
        payload = decode_access_token(token)
    except InvalidTokenError:
        return False
    try:
        user_id = UUID(payload.sub)
    except ValueError:
        return False
    user = await UserRepository(session).get_by_id(user_id)
    if user is None or not user.is_active:
        return False
    project = await ProjectRepository(session).get_by_id(project_id)
    if project is None or project.owner_id != user.id:
        return False
    return True


async def _send_safe(ws: WebSocket, payload: dict) -> None:
    """Send a JSON frame, swallowing the closed-socket race.

    The PTY reader is decoupled from the WebSocket lifetime via
    `loop.add_reader`, so the read can fire after the WS has
    closed. Wrapping every send keeps the logs clean.
    """
    try:
        await ws.send_text(json.dumps(payload))
    except Exception:
        pass
