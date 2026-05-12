"""Authentication wire schemas.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class TokenRead(BaseModel):
    """Response body for `POST /api/v1/auth/login`."""

    access_token: str
    token_type: Literal["bearer"] = "bearer"
    expires_in: int = Field(
        description="Token lifetime in seconds, counted from issuance.",
        ge=1,
    )
