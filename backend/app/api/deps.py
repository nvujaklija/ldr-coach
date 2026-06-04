"""Shared FastAPI dependencies."""

from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import decode_access_token
from app.db.session import get_db
from app.models import Couple, User
from app.services import couples as couple_service

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

    Couple-scoped features require the user to have completed onboarding
    (created or joined a couple). If they haven't, return 400 so the client
    can route them through the onboarding flow.
    """
    couple = couple_service.get_couple_for_user(db, current_user.id)
    if couple is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You need to create or join a couple first",
        )
    return couple


CurrentCouple = Annotated[Couple, Depends(get_current_couple)]
