"""Typed application configuration.
"""

from functools import lru_cache
from typing import Literal

from pydantic import Field, computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict

Environment = Literal["dev", "staging", "prod"]


class Settings(BaseSettings):
    """Runtime configuration for the Syntx backend.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app_env: Environment = "dev"
    debug: bool = True

    postgres_user: str = Field(default="syntx")
    postgres_password: str = Field(default="change-me-in-local-env")
    postgres_db: str = Field(default="syntx")
    postgres_host: str = Field(default="postgres")
    postgres_port: int = Field(default=5432)

    jwt_secret: str = Field(
        min_length=32,
        description="HMAC secret for signing JWT access tokens.",
    )
    jwt_algorithm: Literal["HS256", "HS384", "HS512"] = Field(default="HS256")
    jwt_access_ttl_minutes: int = Field(default=60, ge=1, le=60 * 24)

    ollama_host: str = Field(
        default="http://ollama:11434",
        description="Base URL of the Ollama REST API.",
    )
    ollama_default_model: str = Field(
        default="qwen2.5-coder:1.5b",
        description="Default model name the API advertises to clients.",
    )

    web_search_enabled: bool = Field(
        default=False,
        description=(
            "Master switch for the RAG retriever. When False, the body "
            "flag `use_web_search=true` is silently ignored."
        ),
    )
    web_search_url: str = Field(
        default="https://lite.duckduckgo.com/lite/",
        description="POST endpoint of the search backend. Default: DDG lite.",
    )
    web_search_timeout_seconds: float = Field(
        default=4.0,
        gt=0,
        le=30,
        description=(
            "Per-search HTTP timeout. Kept short: RAG must not stall "
            "the chat endpoint past the user's patience."
        ),
    )
    web_search_max_results: int = Field(
        default=5,
        ge=1,
        le=15,
        description="Hard cap on hits parsed per query (context-budget guard).",
    )

    database_url: str | None = Field(
        default=None,
        description=(
            "Explicit SQLAlchemy URL. When set, it wins over the POSTGRES_* "
            "parts below. Use for managed databases or tests pointing at a "
            "throwaway instance."
        ),
    )

    @computed_field  # type: ignore[prop-decorator]
    @property
    def sqlalchemy_url(self) -> str:
        """Assembled SQLAlchemy URL used by `app.db.session`.
        """
        if self.database_url:
            return self.database_url
        return (
            f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return the process-wide Settings singleton.
    """
    return Settings()
