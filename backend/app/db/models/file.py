"""`File` ORM model.

A file is a (text) document inside a project. This step defines the
schema only; CRUD routes land in STEP 21–22.

Path is identity
----------------
The tuple `(project_id, path)` identifies a file. There is no separate
`parent_id` / `directory` table: directories are implicit (they exist
iff some file has a path starting with that prefix). This is how Git,
S3, and VS Code workspaces model it too. Consequences:

* Renaming a directory is N `UPDATE` statements, bounded by the unique
  constraint below — one transaction, still fast for realistic N.
* Listing a "subtree" is `WHERE path LIKE 'src/%'` — uses the prefix of
  the unique B-tree.
* Empty directories do not exist. If the UI needs them, it tracks them
  client-side; the DB is not the right layer.

Path hygiene
------------
`normalize_path` is a *validator*, not a silent normalizer. It refuses
malformed input rather than guessing what the user meant — a silently
corrected path is a bug incubator in prompts, URLs, and logs.

Accepted form: POSIX-style relative path, forward slashes, no leading or
trailing slash, no empty segments, no `.` or `..` segments, no control
characters, <= `FILE_PATH_MAX_LENGTH` characters.
"""

from __future__ import annotations

import re
from uuid import UUID

from sqlalchemy import ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, UUIDTimestampMixin

FILE_PATH_MAX_LENGTH = 1024

# Control chars (0x00–0x1f) plus DEL (0x7f). Matches what filesystems and
# editors treat as hostile — tab/newline in a filename is almost always a
# bug, never an intent.
_CONTROL_CHARS_RE = re.compile(r"[\x00-\x1f\x7f]")


class InvalidFilePath(ValueError):
    """Raised when a path violates the project's path contract.

    Subclass of `ValueError` so Pydantic `field_validator` can surface it
    as a `422` at the HTTP boundary without extra plumbing.
    """


def normalize_path(raw: str) -> str:
    """Return `raw` iff it is a valid project-relative path; else raise.

    This function is intentionally strict. It is the *only* place path
    rules live — models, schemas, services, and tests all consult it.
    """
    if not isinstance(raw, str):
        raise InvalidFilePath("path must be a string")
    if not raw:
        raise InvalidFilePath("path must not be empty")
    if len(raw) > FILE_PATH_MAX_LENGTH:
        raise InvalidFilePath(f"path exceeds {FILE_PATH_MAX_LENGTH} characters")
    if "\\" in raw:
        raise InvalidFilePath("path must use forward slashes, not backslashes")
    if _CONTROL_CHARS_RE.search(raw):
        raise InvalidFilePath("path must not contain control characters")
    if raw.startswith("/"):
        raise InvalidFilePath("path must be relative (no leading slash)")
    if raw.endswith("/"):
        raise InvalidFilePath("path must not end with a slash")

    segments = raw.split("/")
    for seg in segments:
        if seg == "":
            raise InvalidFilePath("path must not contain empty segments ('//')")
        if seg in (".", ".."):
            raise InvalidFilePath("path must not contain '.' or '..' segments")

    return raw


class File(Base, UUIDTimestampMixin):
    """A text document stored inside a project."""

    __tablename__ = "files"
    __table_args__ = (
        # Natural identity for the domain; indexes `project_id` as a
        # prefix so "list files of project X" uses the same B-tree.
        UniqueConstraint("project_id", "path", name="uq_files_project_id_path"),
    )

    project_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
    )
    path: Mapped[str] = mapped_column(
        String(FILE_PATH_MAX_LENGTH),
        nullable=False,
    )
    # TEXT not VARCHAR: bodies have no useful upper bound at the column
    # level; API schemas cap payload size at their layer.
    content: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        default="",
        server_default="",
    )
    # Denormalised byte size of `content` (UTF-8 encoded). Set by the
    # service on every write. Stored so tree listings can show sizes
    # without paying for `OCTET_LENGTH(content)` over large rows.
    size_bytes: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default="0",
    )
