"""Request/response schemas for authentication."""

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.schemas.couple import CoupleOut


class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    display_name: str = Field(min_length=1, max_length=100)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: EmailStr
    display_name: str


class MeOut(UserOut):
    """The current user plus their couple (null until they onboard)."""

    couple: CoupleOut | None = None
