"""Request/response schemas for user + couple settings.

A single ``/settings`` resource bundles the two scopes the UI edits together:

* ``user`` — per-person preferences (timezone, theme, notification toggles).
* ``couple`` — shared settings (relationship start date, module visibility).
  Null for someone who hasn't onboarded a couple yet.

Both update bodies use ``exclude_unset`` semantics: only the fields a client
sends are changed, so the settings form can submit partial updates.
"""

from datetime import date
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import BaseModel, ConfigDict, field_validator

from app.models.user import USER_THEMES


def _validate_timezone(v: str) -> str:
    try:
        ZoneInfo(v)
    except (ZoneInfoNotFoundError, ValueError):
        raise ValueError("timezone must be a valid IANA name") from None
    return v


def _validate_theme(v: str) -> str:
    if v not in USER_THEMES:
        raise ValueError(f"theme must be one of {USER_THEMES}")
    return v


# --- user scope ----------------------------------------------------------


class UserSettingsOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    timezone: str
    theme: str
    notify_checkin_reminders: bool
    notify_visit_reminders: bool
    notify_ritual_reminders: bool


class UserSettingsUpdate(BaseModel):
    timezone: str | None = None
    theme: str | None = None
    notify_checkin_reminders: bool | None = None
    notify_visit_reminders: bool | None = None
    notify_ritual_reminders: bool | None = None

    _ck_tz = field_validator("timezone")(_validate_timezone)
    _ck_theme = field_validator("theme")(_validate_theme)


# --- couple scope --------------------------------------------------------


class CoupleSettingsOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    relationship_start_date: date | None
    show_visits: bool
    show_rituals: bool
    show_checkins: bool


class CoupleSettingsUpdate(BaseModel):
    relationship_start_date: date | None = None
    show_visits: bool | None = None
    show_rituals: bool | None = None
    show_checkins: bool | None = None

    @field_validator("relationship_start_date")
    @classmethod
    def _not_in_future(cls, v: date | None) -> date | None:
        if v is not None and v > date.today():
            raise ValueError("relationship_start_date cannot be in the future")
        return v


# --- combined resource ---------------------------------------------------


class SettingsOut(BaseModel):
    user: UserSettingsOut
    couple: CoupleSettingsOut | None = None


class SettingsUpdate(BaseModel):
    user: UserSettingsUpdate | None = None
    couple: CoupleSettingsUpdate | None = None
