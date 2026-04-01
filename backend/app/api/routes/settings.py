from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db.dependencies import get_db
from app.models.user import User
from app.schemas.settings import (
    UpdateAccountSettingsRequest,
    UpdateAppPreferencesRequest,
    UserSettingsDetailResponse,
    UserSettingsResponse,
)
from app.schemas.user import UserResponse
from app.services.settings_service import settings_service

router = APIRouter(prefix="/settings", tags=["Settings"])


@router.get(
    "/me",
    response_model=UserSettingsDetailResponse,
    status_code=status.HTTP_200_OK,
)
def get_my_settings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserSettingsDetailResponse:
    user_settings = settings_service.get_or_create_user_settings(db, current_user)

    return UserSettingsDetailResponse(
        account_email=current_user.email,
        account_full_name=current_user.full_name,
        preferences=UserSettingsResponse.model_validate(user_settings),
    )


@router.put(
    "/account",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
)
def update_account_settings(
    payload: UpdateAccountSettingsRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserResponse:
    updated_user = settings_service.update_account_settings(
        db=db,
        current_user=current_user,
        payload=payload,
    )
    return UserResponse.model_validate(updated_user)


@router.put(
    "/preferences",
    response_model=UserSettingsResponse,
    status_code=status.HTTP_200_OK,
)
def update_app_preferences(
    payload: UpdateAppPreferencesRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserSettingsResponse:
    updated_settings = settings_service.update_app_preferences(
        db=db,
        current_user=current_user,
        payload=payload,
    )
    return UserSettingsResponse.model_validate(updated_settings)