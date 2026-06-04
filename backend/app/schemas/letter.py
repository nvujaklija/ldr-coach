"""Request/response schemas for letters.

The output schema is assembled per-viewer in the route layer rather than via
``from_attributes``: whether ``body`` is populated depends on who is asking and
whether the letter has unlocked, which the ORM row alone can't express.
"""

from datetime import datetime

from pydantic import BaseModel, Field


class LetterCreate(BaseModel):
    title: str = Field(min_length=1, max_length=150)
    body: str = Field(min_length=1)
    # When the recipient may open it. Omit (or pass a past time) to send a
    # letter that is readable immediately.
    visible_from: datetime | None = None
    # Recipient; defaults to the partner when omitted. Useful to make explicit
    # in a couple, and lets a solo user write to their future self.
    to_user_id: str | None = None


class LetterOut(BaseModel):
    id: str
    couple_id: str
    from_user_id: str
    to_user_id: str
    from_name: str
    to_name: str
    title: str
    # Null while a received letter is still locked — the server never sends a
    # locked body to its recipient.
    body: str | None
    visible_from: datetime
    is_opened: bool
    is_locked: bool
    # "sent" or "received", relative to the requesting user.
    direction: str
    created_at: datetime
