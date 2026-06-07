"""Request/response schemas for the BeReal feature."""

from datetime import UTC, datetime
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import BaseModel, ConfigDict, field_serializer, field_validator


def _validate_timezone(v: str | None) -> str | None:
    if v is not None:
        try:
            ZoneInfo(v)
        except (ZoneInfoNotFoundError, ValueError):
            raise ValueError("timezone must be a valid IANA name") from None
    return v


def _as_utc(dt: datetime | None) -> datetime | None:
    """Force UTC awareness so JSON always carries an offset.

    SQLite returns naive datetimes for timezone-aware columns; without this the
    serialized value would lack a ``+00:00`` and clients would misread it as
    local time.
    """
    if dt is None:
        return None
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=UTC)


class BeRealEnable(BaseModel):
    # Optional: set the caller's timezone at the same time they turn BeReal on.
    timezone: str | None = None

    _ck_tz = field_validator("timezone")(_validate_timezone)


class BeRealPostOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    image_url: str
    posted_at: datetime

    @field_serializer("posted_at")
    def _ser_posted_at(self, dt: datetime) -> datetime:
        return _as_utc(dt)


class BeRealMomentOut(BaseModel):
    id: str
    scheduled_utc: datetime
    status: str
    # Derived: whether the posting window is currently open.
    is_open: bool
    you_posted: bool
    partner_posted: bool
    # Visibility-filtered: a partner's photo appears only once you've posted.
    posts: list[BeRealPostOut]

    @field_serializer("scheduled_utc")
    def _ser_scheduled(self, dt: datetime) -> datetime:
        return _as_utc(dt)


class PartnerTimeOut(BaseModel):
    user_id: str
    display_name: str
    timezone: str
    # The next moment rendered in this partner's local time, ISO 8601.
    local_time: str | None


class BeRealStatusOut(BaseModel):
    is_active: bool
    next_utc: datetime | None
    current_moment: BeRealMomentOut | None
    partners: list[PartnerTimeOut]

    @field_serializer("next_utc")
    def _ser_next_utc(self, dt: datetime | None) -> datetime | None:
        return _as_utc(dt)


class BeRealMomentList(BaseModel):
    moments: list[BeRealMomentOut]
    total: int
    limit: int
    offset: int
