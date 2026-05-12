"""Cryptographic primitives for authentication.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import bcrypt
import jwt
from pydantic import BaseModel

from app.core.config import get_settings

BCRYPT_ROUNDS: int = 12


def hash_password(plain: str) -> str:
    """Produce a bcrypt hash string from a plaintext password.
    """
    if not isinstance(plain, str):  # pragma: no cover — belt-and-suspenders
        raise TypeError("password must be a str, not bytes")
    hashed = bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt(rounds=BCRYPT_ROUNDS))
    return hashed.decode("ascii")


def verify_password(plain: str, hashed: str) -> bool:
    """Return True iff `plain` matches `hashed`.
    """
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("ascii"))
    except (ValueError, UnicodeError):
        return False



class TokenPayload(BaseModel):
    """Typed view of a decoded access token.
    """

    sub: str
    exp: datetime
    iat: datetime
    type: str


class InvalidTokenError(Exception):
    """Raised by `decode_access_token` for any failure mode.
    """

def create_access_token(
    subject: str,
    expires_delta: timedelta | None = None,
) -> str:
    """Sign a short-lived access token for `subject` (typically a user id).
    """
    settings = get_settings()
    now = datetime.now(UTC)
    expire = now + (expires_delta or timedelta(minutes=settings.jwt_access_ttl_minutes))
    payload: dict[str, object] = {
        "sub": subject,
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
        "type": "access",
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> TokenPayload:
    """Verify signature + expiry and return a typed payload.
    """
    settings = get_settings()
    try:
        raw = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
            options={"require": ["sub", "exp", "iat", "type"]},
        )
    except jwt.PyJWTError as exc:  # includes Expired, InvalidSignature, Decode, …
        raise InvalidTokenError(str(exc)) from exc

    payload = TokenPayload.model_validate(raw)
    if payload.type != "access":
        raise InvalidTokenError(f"unexpected token type: {payload.type!r}")
    return payload
