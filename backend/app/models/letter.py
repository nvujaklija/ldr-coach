"""A letter one partner writes for the other, optionally unlocked in the future.

Letters are a couple's private, time-released messages: write something today
that your partner can only open on a chosen date (an anniversary, a hard week,
a homecoming). The server is the gatekeeper — a letter's body is never sent to
the recipient before ``visible_from``. ``is_opened`` records the first time the
recipient reads it, so the UI can distinguish new mail from already-read mail.
"""

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDMixin


class Letter(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "letters"

    couple_id: Mapped[str] = mapped_column(
        ForeignKey("couples.id", ondelete="CASCADE"), index=True, nullable=False
    )
    from_user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    to_user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    # When the recipient is first allowed to read the body, as an aware UTC
    # datetime. A value in the past means the letter is unlocked immediately.
    visible_from: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    title: Mapped[str] = mapped_column(String(150), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    # Set the first time the recipient opens an unlocked letter.
    is_opened: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
