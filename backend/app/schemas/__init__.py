"""Pydantic schemas — the wire-level contract of the HTTP API.
"""

from app.schemas.ai import (
    ChatMessage,
    ChatRequest,
    ModelRef,
    ModelsResponse,
    ProjectChatRequest,
)
from app.schemas.auth import TokenRead
from app.schemas.file import FileRead, FileTree, FileTreeEntry, FileUpsert
from app.schemas.project import ProjectCreate, ProjectPage, ProjectRead, ProjectUpdate
from app.schemas.user import UserCreate, UserLogin, UserRead

__all__ = [
    "ChatMessage",
    "ChatRequest",
    "FileRead",
    "FileTree",
    "FileTreeEntry",
    "FileUpsert",
    "ModelRef",
    "ModelsResponse",
    "ProjectChatRequest",
    "ProjectCreate",
    "ProjectPage",
    "ProjectRead",
    "ProjectUpdate",
    "TokenRead",
    "UserCreate",
    "UserLogin",
    "UserRead",
]
