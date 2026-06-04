"""Notification routes: the in-app notification center + per-user preferences.

Endpoints:
    GET   /notifications                 list due notifications + unread count
    POST  /notifications/read-all         mark every due notification read
    POST  /notifications/{id}/read        mark one notification read
    GET   /notifications/preferences      read reminder preferences
    PATCH /notifications/preferences      update reminder preferences

"Due" means ``trigger_at <= now``: reminders generated ahead of time stay
hidden until their moment arrives.
"""

from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, select

from app.api.deps import CurrentUser, DbSession
from app.models import Notification
from app.schemas.notification import (
    NotificationList,
    NotificationOut,
    NotificationPreferenceOut,
    NotificationPreferenceUpdate,
)
from app.services import notifications as notification_service

router = APIRouter(prefix="/notifications", tags=["notifications"])

MAX_LIMIT = 100


@router.get("", response_model=NotificationList)
def list_notifications(
    db: DbSession,
    current_user: CurrentUser,
    include_read: bool = False,
    limit: int = Query(50, ge=1, le=MAX_LIMIT),
) -> NotificationList:
    now = datetime.now(UTC)
    base = (
        Notification.user_id == current_user.id,
        Notification.trigger_at <= now,
    )

    stmt = select(Notification).where(*base)
    if not include_read:
        stmt = stmt.where(Notification.read_at.is_(None))
    stmt = stmt.order_by(Notification.trigger_at.desc()).limit(limit)

    notifications = list(db.scalars(stmt))
    unread_count = (
        db.scalar(
            select(func.count())
            .select_from(Notification)
            .where(*base, Notification.read_at.is_(None))
        )
        or 0
    )
    return NotificationList(
        notifications=[NotificationOut.model_validate(n) for n in notifications],
        unread_count=unread_count,
    )


@router.post("/read-all", response_model=NotificationList)
def mark_all_read(db: DbSession, current_user: CurrentUser) -> NotificationList:
    now = datetime.now(UTC)
    unread = db.scalars(
        select(Notification).where(
            Notification.user_id == current_user.id,
            Notification.trigger_at <= now,
            Notification.read_at.is_(None),
        )
    )
    for n in unread:
        n.read_at = now
    db.commit()
    return list_notifications(db, current_user, include_read=False, limit=50)


@router.post("/{notification_id}/read", response_model=NotificationOut)
def mark_read(
    notification_id: str, db: DbSession, current_user: CurrentUser
) -> Notification:
    notification = db.get(Notification, notification_id)
    if notification is None or notification.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found"
        )
    if notification.read_at is None:
        notification.read_at = datetime.now(UTC)
        db.commit()
        db.refresh(notification)
    return notification


@router.get("/preferences", response_model=NotificationPreferenceOut)
def get_preferences(db: DbSession, current_user: CurrentUser) -> NotificationPreferenceOut:
    prefs = notification_service.get_or_create_preference(db, current_user.id)
    return NotificationPreferenceOut.model_validate(prefs)


@router.patch("/preferences", response_model=NotificationPreferenceOut)
def update_preferences(
    payload: NotificationPreferenceUpdate, db: DbSession, current_user: CurrentUser
) -> NotificationPreferenceOut:
    prefs = notification_service.get_or_create_preference(db, current_user.id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(prefs, field, value)
    db.commit()
    db.refresh(prefs)
    return NotificationPreferenceOut.model_validate(prefs)
