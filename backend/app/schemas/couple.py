"""Request/response schemas for couples and partner invites."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class CoupleCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)


class CoupleJoin(BaseModel):
    code: str = Field(min_length=1, max_length=32)


class MemberOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: str
    display_name: str
    role: str


class CoupleOut(BaseModel):
    id: str
    name: str
    members: list[MemberOut]


class InviteOut(BaseModel):
    code: str
    invite_url: str
    expires_at: datetime
    accepted: bool
