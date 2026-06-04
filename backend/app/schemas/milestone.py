"""Request/response schemas for milestones."""

from datetime import date

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.milestone import MILESTONE_STATUSES


class MilestoneCreate(BaseModel):
    visit_id: str | None = None
    title: str = Field(min_length=1, max_length=200)
    due_date: date | None = None
    notes: str | None = None


class MilestoneUpdate(BaseModel):
    """All fields optional — only the ones provided are changed."""

    title: str | None = Field(default=None, min_length=1, max_length=200)
    status: str | None = None
    due_date: date | None = None
    notes: str | None = None

    @field_validator("status")
    @classmethod
    def _check_status(cls, v: str | None) -> str | None:
        if v is not None and v not in MILESTONE_STATUSES:
            raise ValueError(f"status must be one of {MILESTONE_STATUSES}")
        return v


class MilestoneOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    visit_id: str | None
    title: str
    status: str
    due_date: date | None
    notes: str | None
