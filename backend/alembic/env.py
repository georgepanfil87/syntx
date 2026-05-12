"""Alembic environment — async-aware, wired to Syntx settings and metadata.
"""

from __future__ import annotations

import asyncio
from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from alembic import context
from app.core.config import get_settings
from app.db.base import Base

# Model registration
# Importing `app.db.models` triggers the side-effect imports of every ORM
# module so `Base.metadata` is fully populated before autogenerate runs.
try:
    import app.db.models  # noqa: F401  (import for side effects)
except ImportError:
    # autogenerate will produce an empty revision, which is the correct
    # behaviour for this step.
    pass

# Alembic config
config = context.config

# Inject the SQLAlchemy URL from Settings rather than hard-coding it in the
# ini file. Keeps one source of truth and lets CI / tests swap databases
# without editing alembic.ini.
config.set_main_option("sqlalchemy.url", get_settings().sqlalchemy_url)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def _configure_context(connection: Connection) -> None:
    """Shared context configuration for online migrations."""
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        # `compare_type` helps autogenerate catch column-type changes.
        compare_type=True,
        # `compare_server_default` picks up changes to `server_default=`,
        # which matters for our UUID/timestamp mixin.
        compare_server_default=True,
    )


def run_migrations_offline() -> None:
    """Emit SQL to stdout without a live connection.

    Useful for review pipelines that want a SQL preview before applying.
    """
    context.configure(
        url=config.get_main_option("sqlalchemy.url"),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        compare_server_default=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def _do_run_migrations(connection: Connection) -> None:
    _configure_context(connection)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """Online migrations over an async connection (asyncpg)."""
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(_do_run_migrations)
    await connectable.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
