"""Aggregator for every `v1` router.

`main.py` imports `api_router` and mounts it with `prefix="/api/v1"`.
Every feature router is included here, in the order it should appear in
the OpenAPI document.
"""

from __future__ import annotations

from fastapi import APIRouter

from app.api.v1 import (
    admin,
    ai,
    auth,
    chat,
    files,
    git,
    projects,
    search,
    terminal,
    users,
)

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(projects.router)
api_router.include_router(files.router)
api_router.include_router(ai.router)
api_router.include_router(chat.router)
api_router.include_router(search.router)
api_router.include_router(git.router)
api_router.include_router(terminal.router)
api_router.include_router(admin.router)

__all__ = ["api_router"]
