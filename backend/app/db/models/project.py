"""`Project` ORM model.

A project is the top-level container a user works inside: a tree of files,
a chat history, a context buffer for the LLM. Everything file- or chat-
related from STEP 20 onwards hangs off a project id.

Design notes
------------
* **`owner_id` is NOT NULL with `ON DELETE CASCADE`.** An ownerless
  project is orphaned data; we refuse to model it. Deleting a user wipes
  their projects in one SQL statement instead of spreading cleanup logic
  across services. If that is ever too aggressive (e.g. GDPR "soft
  delete"), the change is a migration + a column, not a schema redesign.
* **Unique constraint `(owner_id, name)`** — a single user cannot have
  two projects with the same name, but two users may. This is the natural
  uniqueness for the domain (cf. GitHub's `user/repo` model). The
  constraint's B-tree index also serves the "list my projects" query
  (prefix match on `owner_id`), so no separate index on `owner_id` is
  needed.
* **No `relationship()` yet.** A back-reference (`User.projects`) or a
  forward one (`Project.owner`) forces a loading-strategy decision that
  we cannot make informed without a real caller. Deferred to the step
  that introduces one, per the "extract on second use" rule.
* **`name` is plain `VARCHAR`, not `CITEXT`.** Programmers care about
  case in identifiers (`README` ≠ `readme`); we keep native semantics.
"""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, UUIDTimestampMixin

# Upper bound on project name length. 120 chars fits comfortably in UI
# breadcrumbs without tempting users to cram a description into the name.
PROJECT_NAME_MAX_LENGTH = 120


class Project(Base, UUIDTimestampMixin):
    """A user's workspace: the root for files, chats, and AI context."""

    __tablename__ = "projects"
    __table_args__ = (
        # Natural uniqueness for the domain. Also indexes `owner_id` as a
        # prefix, which is all the "list my projects" query needs.
        UniqueConstraint("owner_id", "name", name="uq_projects_owner_id_name"),
    )

    owner_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(
        String(PROJECT_NAME_MAX_LENGTH),
        nullable=False,
    )
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
