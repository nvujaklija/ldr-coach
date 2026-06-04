"""Request/response schemas for visits."""

from datetime import date

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.visit import VISIT_STATUSES


class VisitCreate(BaseModel):
    location: str = Field(min_length=1, max_length=200)
    start_date: date
    end_date: date | None = None
    notes: str | None = None

    @model_validator(mode="after")
    def _end_after_start(self) -> "VisitCreate":
        if self.end_date is not None and self.end_date < self.start_date:
            raise ValueError("end_date cannot be before start_date")
        return self


class VisitUpdate(BaseModel):
    """All fields optional — only the ones provided are changed."""

    location: str | None = Field(default=None, min_length=1, max_length=200)
    start_date: date | None = None
    end_date: date | None = None
    notes: str | None = None
    status: str | None = None

    @model_validator(mode="after")
    def _validate(self) -> "VisitUpdate":
        if self.status is not None and self.status not in VISIT_STATUSES:
            raise ValueError(f"status must be one of {VISIT_STATUSES}")
        if (
            self.start_date is not None
            and self.end_date is not None
            and self.end_date < self.start_date
        ):
            raise ValueError("end_date cannot be before start_date")
        return self


class VisitOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    location: str
    start_date: date
    end_date: date | None
    notes: str | None
    status: str
    days_until: int | None = None
