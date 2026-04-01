from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ProjectBase(BaseModel):
    title: str = Field(min_length=2, max_length=255)
    description: str | None = None
    app_type: str = Field(min_length=2, max_length=100)
    frontend_stack: str = Field(min_length=2, max_length=100)
    backend_stack: str = Field(min_length=2, max_length=100)
    database_type: str | None = Field(default=None, max_length=100)


class CreateProjectRequest(ProjectBase):
    pass


class UpdateProjectRequest(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=255)
    description: str | None = None
    app_type: str | None = Field(default=None, min_length=2, max_length=100)
    frontend_stack: str | None = Field(default=None, min_length=2, max_length=100)
    backend_stack: str | None = Field(default=None, min_length=2, max_length=100)
    database_type: str | None = Field(default=None, max_length=100)
    status: str | None = Field(default=None, min_length=2, max_length=50)


class ProjectResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    owner_id: int
    title: str
    description: str | None
    app_type: str
    frontend_stack: str
    backend_stack: str
    database_type: str | None
    status: str
    created_at: datetime
    updated_at: datetime