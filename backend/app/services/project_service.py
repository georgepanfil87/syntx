from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.core.exceptions import NotFoundException
from app.models.project import Project
from app.models.user import User
from app.schemas.project import CreateProjectRequest, UpdateProjectRequest


class ProjectService:
    def create_project(
        self,
        db: Session,
        current_user: User,
        payload: CreateProjectRequest,
    ) -> Project:
        project = Project(
            owner_id=current_user.id,
            title=payload.title,
            description=payload.description,
            app_type=payload.app_type,
            frontend_stack=payload.frontend_stack,
            backend_stack=payload.backend_stack,
            database_type=payload.database_type,
            status="draft",
        )

        db.add(project)
        db.commit()
        db.refresh(project)

        return project

    def get_projects_for_user(
        self,
        db: Session,
        current_user: User,
    ) -> list[Project]:
        statement = (
            select(Project)
            .where(Project.owner_id == current_user.id)
            .order_by(desc(Project.updated_at))
        )
        return list(db.scalars(statement).all())

    def get_recent_projects_for_user(
        self,
        db: Session,
        current_user: User,
        limit: int = 10,
    ) -> list[Project]:
        statement = (
            select(Project)
            .where(Project.owner_id == current_user.id)
            .order_by(desc(Project.updated_at))
            .limit(limit)
        )
        return list(db.scalars(statement).all())

    def get_project_by_id_for_user(
        self,
        db: Session,
        current_user: User,
        project_id: int,
    ) -> Project:
        statement = select(Project).where(
            Project.id == project_id,
            Project.owner_id == current_user.id,
        )
        project = db.scalar(statement)

        if project is None:
            raise NotFoundException("Project not found")

        return project

    def update_project(
        self,
        db: Session,
        current_user: User,
        project_id: int,
        payload: UpdateProjectRequest,
    ) -> Project:
        project = self.get_project_by_id_for_user(
            db=db,
            current_user=current_user,
            project_id=project_id,
        )

        update_data = payload.model_dump(exclude_unset=True)

        for field_name, field_value in update_data.items():
            setattr(project, field_name, field_value)

        db.add(project)
        db.commit()
        db.refresh(project)

        return project

    def delete_project(
        self,
        db: Session,
        current_user: User,
        project_id: int,
    ) -> None:
        project = self.get_project_by_id_for_user(
            db=db,
            current_user=current_user,
            project_id=project_id,
        )

        db.delete(project)
        db.commit()


project_service = ProjectService()