from sqlalchemy.orm import Session

from app.core.exceptions import AuthenticationException, ConflictException
from app.core.security.jwt import create_access_token
from app.core.security.password import hash_password, verify_password
from app.models.user import User
from app.models.user_settings import UserSettings
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse
from app.services.user_service import user_service


class AuthService:
    def register_user(self, db: Session, payload: RegisterRequest) -> User:
        existing_user = user_service.get_user_by_email(db, payload.email)
        if existing_user is not None:
            raise ConflictException("A user with this email already exists")

        user = User(
            email=payload.email,
            full_name=payload.full_name,
            hashed_password=hash_password(payload.password),
            is_active=True,
            is_superuser=False,
        )

        db.add(user)
        db.flush()

        user_settings = UserSettings(
            user_id=user.id,
            theme="dark",
            language="ro",
        )
        db.add(user_settings)

        db.commit()
        db.refresh(user)

        return user

    def authenticate_user(self, db: Session, payload: LoginRequest) -> TokenResponse:
        user = user_service.get_user_by_email(db, payload.email)
        if user is None:
            raise AuthenticationException("Invalid email or password")

        if not verify_password(payload.password, user.hashed_password):
            raise AuthenticationException("Invalid email or password")

        if not user.is_active:
            raise AuthenticationException("User account is inactive")

        access_token = create_access_token(subject=str(user.id))

        return TokenResponse(access_token=access_token)


auth_service = AuthService()