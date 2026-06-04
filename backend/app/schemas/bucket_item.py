"""Request/response schemas for bucket-list items."""

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.bucket_item import BUCKET_STATUSES


def _validate_status(v: str | None) -> str | None:
    if v is not None and v not in BUCKET_STATUSES:
        raise ValueError(f"status must be one of {BUCKET_STATUSES}")
    return v


class BucketItemCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    category: str | None = Field(default=None, max_length=50)
    target_visit_id: str | None = None
    notes: str | None = None


class BucketItemUpdate(BaseModel):
    """All fields optional — only the ones provided are changed."""

    title: str | None = Field(default=None, min_length=1, max_length=200)
    category: str | None = Field(default=None, max_length=50)
    target_visit_id: str | None = None
    status: str | None = None
    notes: str | None = None

    _ck_status = field_validator("status")(_validate_status)


class BucketItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    category: str | None
    target_visit_id: str | None
    status: str
    notes: str | None
