"""A recurring shared ritual (e.g. weekly movie night)."""

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDMixin


class Ritual(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "rituals"

    couple_id: Mapped[str] = mapped_column(
        ForeignKey("couples.id", ondelete="CASCADE"), index=True, nullable=False
    )
    title: Mapped[str] = mapped_column(String(150), nullable=False)
    # e.g. "daily", "weekly", "monthly"
    cadence: Mapped[str] = mapped_column(String(40), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
