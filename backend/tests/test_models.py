"""Smoke test: models create and relate against an in-memory SQLite DB."""

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from app.db.base import Base
from app.models import Couple, CoupleMember, User


def test_create_user_and_couple() -> None:
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        user = User(
            email="alex@example.com",
            hashed_password="x",
            display_name="Alex",
        )
        couple = Couple(name="Alex & Sam")
        session.add_all([user, couple])
        session.flush()

        session.add(CoupleMember(couple_id=couple.id, user_id=user.id))
        session.commit()

        loaded = session.scalar(select(User).where(User.email == "alex@example.com"))
        assert loaded is not None
        assert loaded.id  # UUID default populated
        assert loaded.created_at is not None

        member = session.scalar(select(CoupleMember))
        assert member.couple_id == couple.id
        assert member.role == "partner"
