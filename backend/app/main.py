"""ASGI entrypoint for the Syntx backend."""

from fastapi import Depends, FastAPI
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app import __version__
from app.api.v1.router import api_router
from app.core.config import Settings, get_settings
from app.db.session import get_session

settings = get_settings()

app = FastAPI(
    title="Syntx API",
    version=__version__,
    docs_url="/docs" if settings.debug else None,
    redoc_url="/redoc" if settings.debug else None,
    openapi_url="/openapi.json" if settings.debug else None,
)

# Feature routers live under /api/v1 (see app/api/__init__.py).
app.include_router(api_router, prefix="/api/v1")


@app.get("/health", tags=["meta"], summary="Liveness probe")
def health(settings: Settings = Depends(get_settings)) -> dict[str, str]:
    """Liveness: "is this process alive and serving?" Does NOT touch the DB."""
    return {
        "status": "ok",
        "service": "syntx-backend",
        "version": __version__,
        "environment": settings.app_env,
    }


@app.get("/ready", tags=["meta"], summary="Readiness probe")
async def ready(session: AsyncSession = Depends(get_session)) -> dict[str, str]:
    """Readiness: verifies the DB is reachable with `SELECT 1`.

    Returns 200 on success. On failure, SQLAlchemy raises and FastAPI turns
    it into a 500 — exactly the signal an orchestrator needs to stop
    routing traffic here. We do not catch the exception: a muted readiness
    probe is worse than a loud failure.
    """
    result = await session.execute(text("SELECT 1"))
    (value,) = result.one()
    return {
        "status": "ready",
        "database": "up" if value == 1 else "unexpected",
    }
