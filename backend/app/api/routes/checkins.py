"""Daily mood/connection check-in routes.

Check-ins are scoped to the logged-in user's couple when they belong to one,
falling back to just their own check-ins otherwise. Submitting is idempotent
per calendar day: posting again for today updates that day's row. Domain logic
lives in ``app.services.checkins``; this module is HTTP only.
"""

from fastapi import APIRouter, Query, Response, status

from app.api.deps import CurrentUser, DbSession
from app.models import CheckIn
from app.schemas.check_in import CheckInCreate, CheckInList, CheckInOut
from app.services import checkins as checkin_service

router = APIRouter(prefix="/checkins", tags=["checkins"])


@router.post("/today", response_model=CheckInOut)
def upsert_today(
    payload: CheckInCreate,
    db: DbSession,
    current_user: CurrentUser,
    response: Response,
) -> CheckIn:
    check_in, created = checkin_service.upsert_today(db, current_user.id, payload)
    if created:
        response.status_code = status.HTTP_201_CREATED
    return check_in


@router.get("", response_model=CheckInList)
def list_check_ins(
    db: DbSession,
    current_user: CurrentUser,
    days: int = Query(checkin_service.DEFAULT_RANGE_DAYS, ge=1, le=checkin_service.MAX_RANGE_DAYS),
) -> CheckInList:
    return checkin_service.list_check_ins(db, current_user.id, days)
