"""`User` ORM model — the root aggregate of the authentication domain.

Shape decisions
---------------
* **Email as `CITEXT`.** Case-insensitive equality without `LOWER(email)`
  everywhere. The `citext` extension is enabled in STEP 4's init script.
* **Unique index on email.** One account per address. The uniqueness is
  declared at the DB level — no race between "check then insert".
* **`password_hash: str` (no password).** Plaintext passwords never hit
  the model. Hashing lives in `app.core.security` (STEP 13).
* **`is_active: bool`.** Lets the service layer soft-disable a user
  without deleting rows (audit trail kept intact). Default true.

Intentionally absent at this step
---------------------------------
* No `full_name`, `avatar_url`, or preferences. Fields land when a product
  need calls for them — not speculatively.
* No relationships yet. `Project`, `Chat`, etc. will declare the
  back-reference when their own models are introduced.
"""

from sqlalchemy.dialects.postgresql import CITEXT
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, UUIDTimestampMixin


class User(Base, UUIDTimestampMixin):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(CITEXT, unique=True, nullable=False, index=True)

    password_hash: Mapped[str] = mapped_column(nullable=False)
    """Opaque bcrypt hash. Validated and produced by `app.core.security`."""

    is_active: Mapped[bool] = mapped_column(
        nullable=False,
        server_default="true",
    )

    def __repr__(self) -> str:  # pragma: no cover — debug helper only
        return f"<User id={self.id} email={self.email!r} active={self.is_active}>"
