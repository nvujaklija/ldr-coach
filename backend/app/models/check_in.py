"""A daily emotional check-in posted by one partner."""

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDMixin


class CheckIn(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "check_ins"

    couple_id: Mapped[str] = mapped_column(
        ForeignKey("couples.id", ondelete="CASCADE"), index=True, nullable=False
    )
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    # e.g. "great", "okay", "missing-you"
    mood: Mapped[str] = mapped_column(String(40), nullable=False)
    message: Mapped[str | None] = mapped_column(Text, nullable=True)
