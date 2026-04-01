from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.exceptions import NotFoundException
from app.models.user import User


class UserService:
    def get_user_by_email(self, db: Session, email: str) -> User | None:
        statement = select(User).where(User.email == email)
        return db.scalar(statement)

    def get_user_by_id(self, db: Session, user_id: int) -> User:
        statement = select(User).where(User.id == user_id)
        user = db.scalar(statement)

        if user is None:
            raise NotFoundException("User not found")

        return user


user_service = UserService()