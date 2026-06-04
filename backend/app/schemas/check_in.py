"""Request/response schemas for daily mood/connection check-ins."""

from datetime import date

from pydantic import BaseModel, ConfigDict, Field

SCORE_MIN = 1
SCORE_MAX = 5


class CheckInCreate(BaseModel):
    """Payload for submitting (or re-submitting) today's check-in."""

    mood_score: int = Field(ge=SCORE_MIN, le=SCORE_MAX)
    connection_score: int = Field(ge=SCORE_MIN, le=SCORE_MAX)
    tags: list[str] = Field(default_factory=list, max_length=20)
    note: str | None = Field(default=None, max_length=2000)


class CheckInOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    couple_id: str | None
    date: date
    mood_score: int
    connection_score: int
    tags: list[str]
    note: str | None


class CheckInAverages(BaseModel):
    """Mean scores over a window, used to hint at trends. None when empty."""

    count: int
    mood_score: float | None
    connection_score: float | None


class CheckInList(BaseModel):
    """Recent check-ins plus rolling averages for the requested window."""

    check_ins: list[CheckInOut]
    averages: CheckInAverages
