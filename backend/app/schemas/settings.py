from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field


ThemeOption = Literal["light", "dark"]
LanguageOption = Literal["ro", "en"]


class UserSettingsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    theme: ThemeOption
    language: LanguageOption
    created_at: datetime
    updated_at: datetime


class UserSettingsDetailResponse(BaseModel):
    account_email: EmailStr
    account_full_name: str
    preferences: UserSettingsResponse


class UpdateAccountSettingsRequest(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=2, max_length=255)


class UpdateAppPreferencesRequest(BaseModel):
    theme: ThemeOption
    language: LanguageOption