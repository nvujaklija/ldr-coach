"""Settings routes: read and update per-user and shared couple preferences.

Endpoints:
    GET /settings    current user's prefs + their couple's shared settings
    PUT /settings    update either scope; only the fields sent are changed
"""

from fastapi import APIRouter, HTTPException, status

from app.api.deps import CurrentUser, DbSession
from app.models import Couple
from app.schemas.settings import (
    CoupleSettingsOut,
    SettingsOut,
    SettingsUpdate,
    UserSettingsOut,
)
from app.services import couples as couple_service

router = APIRouter(prefix="/settings", tags=["settings"])


def _build_out(user: CurrentUser, couple: Couple | None) -> SettingsOut:
    return SettingsOut(
        user=UserSettingsOut.model_validate(user),
        couple=CoupleSettingsOut.model_validate(couple) if couple else None,
    )


@router.get("", response_model=SettingsOut)
def get_settings(current_user: CurrentUser, db: DbSession) -> SettingsOut:
    couple = couple_service.get_couple_for_user(db, current_user.id)
    return _build_out(current_user, couple)


@router.put("", response_model=SettingsOut)
def update_settings(
    payload: SettingsUpdate, current_user: CurrentUser, db: DbSession
) -> SettingsOut:
    couple = couple_service.get_couple_for_user(db, current_user.id)

    if payload.user is not None:
        for field, value in payload.user.model_dump(exclude_unset=True).items():
            setattr(current_user, field, value)

    if payload.couple is not None:
        if couple is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You need to create or join a couple first",
            )
        for field, value in payload.couple.model_dump(exclude_unset=True).items():
            setattr(couple, field, value)

    db.commit()
    db.refresh(current_user)
    if couple is not None:
        db.refresh(couple)
    return _build_out(current_user, couple)
