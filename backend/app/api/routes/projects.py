from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.common.schemas import MessageResponse
from app.core.security import get_current_user
from app.db.dependencies import get_db
from app.models.user import User
from app.schemas.project import (
    CreateProjectRequest,
    ProjectResponse,
    UpdateProjectRequest,
)
from app.services.project_service import project_service

router = APIRouter(prefix="/projects", tags=["Projects"])


@router.post(
    "",
    response_model=ProjectResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_project(
    payload: CreateProjectRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProjectResponse:
    project = project_service.create_project(
        db=db,
        current_user=current_user,
        payload=payload,
    )
    return ProjectResponse.model_validate(project)


@router.get(
    "",
    response_model=list[ProjectResponse],
    status_code=status.HTTP_200_OK,
)
def list_projects(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ProjectResponse]:
    projects = project_service.get_projects_for_user(
        db=db,
        current_user=current_user,
    )
    return [ProjectResponse.model_validate(project) for project in projects]


@router.get(
    "/recent",
    response_model=list[ProjectResponse],
    status_code=status.HTTP_200_OK,
)
def list_recent_projects(
    limit: int = Query(default=10, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ProjectResponse]:
    projects = project_service.get_recent_projects_for_user(
        db=db,
        current_user=current_user,
        limit=limit,
    )
    return [ProjectResponse.model_validate(project) for project in projects]


@router.get(
    "/{project_id}",
    response_model=ProjectResponse,
    status_code=status.HTTP_200_OK,
)
def get_project(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProjectResponse:
    project = project_service.get_project_by_id_for_user(
        db=db,
        current_user=current_user,
        project_id=project_id,
    )
    return ProjectResponse.model_validate(project)


@router.patch(
    "/{project_id}",
    response_model=ProjectResponse,
    status_code=status.HTTP_200_OK,
)
def update_project(
    project_id: int,
    payload: UpdateProjectRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProjectResponse:
    project = project_service.update_project(
        db=db,
        current_user=current_user,
        project_id=project_id,
        payload=payload,
    )
    return ProjectResponse.model_validate(project)


@router.delete(
    "/{project_id}",
    response_model=MessageResponse,
    status_code=status.HTTP_200_OK,
)
def delete_project(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageResponse:
    project_service.delete_project(
        db=db,
        current_user=current_user,
        project_id=project_id,
    )
    return MessageResponse(message="Project deleted successfully")