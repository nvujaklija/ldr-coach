"""Shared FastAPI dependencies."""

from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import decode_access_token
from app.db.session import get_db
from app.models import Couple, CoupleMember, User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_PREFIX}/auth/login")

DbSession = Annotated[Session, Depends(get_db)]


def get_current_user(
    db: DbSession,
    token: Annotated[str, Depends(oauth2_scheme)],
) -> User:
    credentials_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    user_id = decode_access_token(token)
    if user_id is None:
        raise credentials_exc
    user = db.get(User, user_id)
    if user is None:
        raise credentials_exc
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def get_current_couple(db: DbSession, current_user: CurrentUser) -> Couple:
    """Return the couple the current user belongs to.

    There is no couple create/join flow yet, so for now we lazily provision a
    couple (and membership) the first time an authenticated user needs one.
    This keeps couple-scoped features usable immediately; a real partner-invite
    flow can replace this later without changing call sites.
    """
    membership = db.scalar(
        select(CoupleMember).where(CoupleMember.user_id == current_user.id)
    )
    if membership is not None:
        couple = db.get(Couple, membership.couple_id)
        if couple is not None:
            return couple

    couple = Couple(name=f"{current_user.display_name}'s couple")
    db.add(couple)
    db.flush()
    db.add(CoupleMember(couple_id=couple.id, user_id=current_user.id))
    db.commit()
    db.refresh(couple)
    return couple


CurrentCouple = Annotated[Couple, Depends(get_current_couple)]
