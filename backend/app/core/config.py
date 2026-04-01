from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Syntx API"
    app_version: str = "0.1.0"
    api_v1_prefix: str = "/api/v1"

    database_url: str = "postgresql+psycopg2://syntx_user:syntx_password@postgres:5432/syntx_db"

    secret_key: str = "change-me"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60

    backend_cors_origins: list[str] | str = ["http://localhost:4200"]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    @field_validator("backend_cors_origins", mode="before")
    @classmethod
    def assemble_cors_origins(cls, value: list[str] | str) -> list[str]:
        if isinstance(value, list):
            return value
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return []


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()