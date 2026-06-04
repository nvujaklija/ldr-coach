"""Request/response schemas for notifications and preferences."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class NotificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    type: str
    title: str
    body: str | None
    payload: dict
    trigger_at: datetime
    read_at: datetime | None
    created_at: datetime


class NotificationList(BaseModel):
    notifications: list[NotificationOut]
    unread_count: int


class NotificationPreferenceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    visit_reminder_days: int
    visit_reminders_enabled: bool
    ritual_reminders_enabled: bool
    in_app_enabled: bool
    email_enabled: bool


class NotificationPreferenceUpdate(BaseModel):
    """All fields optional — only the ones provided are changed."""

    visit_reminder_days: int | None = Field(default=None, ge=0, le=60)
    visit_reminders_enabled: bool | None = None
    ritual_reminders_enabled: bool | None = None
    in_app_enabled: bool | None = None
    email_enabled: bool | None = None
