from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy.orm import Session

from app.core.exceptions import AuthenticationException
from app.core.security.jwt import decode_access_token
from app.db.dependencies import get_db
from app.models.user import User
from app.services.user_service import user_service

bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None:
        raise AuthenticationException("Authentication credentials were not provided")

    token = credentials.credentials

    try:
        payload = decode_access_token(token)
    except JWTError as exc:
        raise AuthenticationException("Invalid or expired access token") from exc

    subject = payload.get("sub")
    if subject is None:
        raise AuthenticationException("Invalid access token payload")

    try:
        user_id = int(subject)
    except ValueError as exc:
        raise AuthenticationException("Invalid access token subject") from exc

    user = user_service.get_user_by_id(db, user_id)

    if not user.is_active:
        raise AuthenticationException("User account is inactive")

    return user