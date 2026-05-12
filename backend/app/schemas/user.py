"""Wire-level schemas for user resources.
"""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, SecretStr

# Bcrypt's hard limit on plaintext input (in bytes). Keeping the constant
# here documents *why* the max_length is what it is; the security module
# owns the algorithm, this module owns the contract.
PASSWORD_MIN_LENGTH = 8
PASSWORD_MAX_LENGTH = 72


class UserCreate(BaseModel):
    """Request body for `POST /api/v1/auth/register`.

    The password is `SecretStr` so it prints as `**********` in logs and
    exception chains. Handlers call `.get_secret_value()` exactly once,
    at the point where the plaintext is handed to `hash_password`.
    """

    email: EmailStr
    password: SecretStr = Field(
        min_length=PASSWORD_MIN_LENGTH,
        max_length=PASSWORD_MAX_LENGTH,
    )


class UserLogin(BaseModel):
    """Request body for `POST /api/v1/auth/login`.

    Intentionally separate from `UserCreate`: login has no length floor,
    but keeps the max length so degenerate inputs never reach bcrypt.
    """

    email: EmailStr
    password: SecretStr = Field(max_length=PASSWORD_MAX_LENGTH)


class UserRead(BaseModel):
    """Public response shape — safe to return from any handler.
    """

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: EmailStr
    is_active: bool
    created_at: datetime
