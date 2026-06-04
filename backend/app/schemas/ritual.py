"""Request/response schemas for rituals."""

import re
from datetime import datetime
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.ritual import (
    COUPLE_RITUAL_STATUSES,
    RITUAL_CADENCES,
    RITUAL_INSTANCE_STATUSES,
)

_TIME_RE = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")


def _validate_cadence(v: str | None) -> str | None:
    if v is not None and v not in RITUAL_CADENCES:
        raise ValueError(f"cadence must be one of {RITUAL_CADENCES}")
    return v


def _validate_time(v: str | None) -> str | None:
    if v is not None and not _TIME_RE.match(v):
        raise ValueError("time_of_day must be 24h HH:MM")
    return v


def _validate_timezone(v: str | None) -> str | None:
    if v is not None:
        try:
            ZoneInfo(v)
        except (ZoneInfoNotFoundError, ValueError):
            raise ValueError("timezone must be a valid IANA name") from None
    return v


class RitualTemplateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    key: str
    title: str
    description: str | None
    default_cadence: str
    icon: str | None


class RitualInstanceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    scheduled_for: datetime
    status: str


class RitualOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    template_key: str | None
    title: str
    cadence: str
    description: str | None
    day_of_week: int | None
    day_of_month: int | None
    time_of_day: str | None
    timezone: str | None
    status: str
    next_instance: RitualInstanceOut | None = None


class RitualCreate(BaseModel):
    template_key: str | None = None
    title: str = Field(min_length=1, max_length=150)
    cadence: str
    description: str | None = None
    day_of_week: int | None = Field(default=None, ge=0, le=6)
    day_of_month: int | None = Field(default=None, ge=1, le=31)
    time_of_day: str | None = None
    timezone: str | None = None

    _ck_cadence = field_validator("cadence")(_validate_cadence)
    _ck_time = field_validator("time_of_day")(_validate_time)
    _ck_tz = field_validator("timezone")(_validate_timezone)


class RitualUpdate(BaseModel):
    """All fields optional — only the ones provided are changed."""

    title: str | None = Field(default=None, min_length=1, max_length=150)
    cadence: str | None = None
    description: str | None = None
    day_of_week: int | None = Field(default=None, ge=0, le=6)
    day_of_month: int | None = Field(default=None, ge=1, le=31)
    time_of_day: str | None = None
    timezone: str | None = None
    status: str | None = None

    _ck_cadence = field_validator("cadence")(_validate_cadence)
    _ck_time = field_validator("time_of_day")(_validate_time)
    _ck_tz = field_validator("timezone")(_validate_timezone)

    @field_validator("status")
    @classmethod
    def _check_status(cls, v: str | None) -> str | None:
        if v is not None and v not in COUPLE_RITUAL_STATUSES:
            raise ValueError(f"status must be one of {COUPLE_RITUAL_STATUSES}")
        return v


class RitualInstanceUpdate(BaseModel):
    status: str

    @field_validator("status")
    @classmethod
    def _check_status(cls, v: str) -> str:
        if v not in RITUAL_INSTANCE_STATUSES:
            raise ValueError(f"status must be one of {RITUAL_INSTANCE_STATUSES}")
        return v
