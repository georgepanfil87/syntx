from sqlalchemy.orm import Session

from app.core.exceptions import ConflictException
from app.models.user import User
from app.models.user_settings import UserSettings
from app.schemas.settings import (
    UpdateAccountSettingsRequest,
    UpdateAppPreferencesRequest,
)
from app.services.user_service import user_service


class SettingsService:
    def get_or_create_user_settings(self, db: Session, user: User) -> UserSettings:
        if user.settings is not None:
            return user.settings

        settings = UserSettings(
            user_id=user.id,
            theme="dark",
            language="ro",
        )

        db.add(settings)
        db.commit()
        db.refresh(settings)

        return settings

    def update_account_settings(
        self,
        db: Session,
        current_user: User,
        payload: UpdateAccountSettingsRequest,
    ) -> User:
        existing_user = user_service.get_user_by_email(db, payload.email)

        if existing_user is not None and existing_user.id != current_user.id:
            raise ConflictException("A user with this email already exists")

        current_user.email = payload.email
        current_user.full_name = payload.full_name

        db.add(current_user)
        db.commit()
        db.refresh(current_user)

        return current_user

    def update_app_preferences(
        self,
        db: Session,
        current_user: User,
        payload: UpdateAppPreferencesRequest,
    ) -> UserSettings:
        settings = self.get_or_create_user_settings(db, current_user)

        settings.theme = payload.theme
        settings.language = payload.language

        db.add(settings)
        db.commit()
        db.refresh(settings)

        return settings


settings_service = SettingsService()