"""Request/response schemas for memory-timeline items."""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, field_validator

from app.models.memory_item import MEMORY_ITEM_TYPES


class MemoryCreate(BaseModel):
    type: str
    # Free-form, kind-specific payload. A "title" key is conventional and used
    # by the timeline as the headline, but not required at this layer.
    data: dict[str, Any] = {}

    @field_validator("type")
    @classmethod
    def _check_type(cls, v: str) -> str:
        if v not in MEMORY_ITEM_TYPES:
            raise ValueError(f"type must be one of {MEMORY_ITEM_TYPES}")
        return v


class MemoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    type: str
    data: dict[str, Any]
    created_by_id: str | None
    created_at: datetime
