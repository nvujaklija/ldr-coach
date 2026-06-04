"""Letter routes: time-released messages between partners.

Endpoints:
    GET   /letters?box=inbox|sent     list received (default) or sent letters
    POST  /letters                     write a letter, optionally future-dated
    POST  /letters/{id}/open           mark a received, unlocked letter opened

The server is the gatekeeper for the future-unlock rule: a letter's ``body`` is
never serialized to its recipient while ``visible_from`` is in the future. The
sender always sees their own body (they wrote it).
"""

from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import select

from app.api.deps import CurrentCouple, CurrentUser, DbSession
from app.models import Letter, User
from app.schemas.letter import LetterCreate, LetterOut
from app.services import couples as couple_service

router = APIRouter(prefix="/letters", tags=["letters"])


def _as_aware_utc(dt: datetime) -> datetime:
    """Treat naive datetimes as UTC so comparisons never raise."""
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=UTC)


def _to_out(letter: Letter, *, viewer_id: str, names: dict[str, str]) -> LetterOut:
    """Serialize a letter for one viewer, hiding the body when appropriate.

    A letter is locked until ``visible_from``. The recipient never receives a
    locked body; the sender always does.
    """
    locked = _as_aware_utc(letter.visible_from) > datetime.now(UTC)
    is_sender = letter.from_user_id == viewer_id
    body = letter.body if (is_sender or not locked) else None
    return LetterOut(
        id=letter.id,
        couple_id=letter.couple_id,
        from_user_id=letter.from_user_id,
        to_user_id=letter.to_user_id,
        from_name=names.get(letter.from_user_id, "Unknown"),
        to_name=names.get(letter.to_user_id, "Unknown"),
        title=letter.title,
        body=body,
        visible_from=letter.visible_from,
        is_opened=letter.is_opened,
        is_locked=locked,
        direction="sent" if is_sender else "received",
        created_at=letter.created_at,
    )


def _name_map(db: DbSession, letters: list[Letter]) -> dict[str, str]:
    """display_name for every user referenced by the given letters."""
    ids = {lt.from_user_id for lt in letters} | {lt.to_user_id for lt in letters}
    if not ids:
        return {}
    rows = db.execute(
        select(User.id, User.display_name).where(User.id.in_(ids))
    ).all()
    return {uid: name for uid, name in rows}


@router.get("", response_model=list[LetterOut])
def list_letters(
    db: DbSession,
    user: CurrentUser,
    couple: CurrentCouple,
    box: str = Query(default="inbox", pattern="^(inbox|sent)$"),
) -> list[LetterOut]:
    """Letters for the current user — received (inbox) or sent.

    Inbox is ordered by unlock time (soonest first) so the next letter to open
    surfaces at the top; sent is newest-first.
    """
    stmt = select(Letter).where(Letter.couple_id == couple.id)
    if box == "sent":
        stmt = stmt.where(Letter.from_user_id == user.id).order_by(
            Letter.created_at.desc()
        )
    else:
        stmt = stmt.where(Letter.to_user_id == user.id).order_by(
            Letter.visible_from.asc()
        )
    letters = list(db.scalars(stmt))
    names = _name_map(db, letters)
    return [_to_out(lt, viewer_id=user.id, names=names) for lt in letters]


@router.post("", response_model=LetterOut, status_code=status.HTTP_201_CREATED)
def create_letter(
    payload: LetterCreate, db: DbSession, user: CurrentUser, couple: CurrentCouple
) -> LetterOut:
    # Resolve the recipient: an explicit to_user_id (validated to be a couple
    # member) wins; otherwise default to the partner, falling back to self for
    # a solo user writing to their future self.
    if payload.to_user_id is not None:
        member_ids = {
            m.user_id for m in couple_service.list_members(db, couple.id)
        }
        if payload.to_user_id not in member_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Recipient must be a member of your couple",
            )
        to_user_id = payload.to_user_id
    else:
        partner = couple_service.get_partner(db, couple.id, user.id)
        to_user_id = partner.id if partner is not None else user.id

    visible_from = payload.visible_from or datetime.now(UTC)
    letter = Letter(
        couple_id=couple.id,
        from_user_id=user.id,
        to_user_id=to_user_id,
        visible_from=visible_from,
        title=payload.title,
        body=payload.body,
        is_opened=False,
    )
    db.add(letter)
    db.commit()
    db.refresh(letter)
    names = _name_map(db, [letter])
    return _to_out(letter, viewer_id=user.id, names=names)


@router.post("/{letter_id}/open", response_model=LetterOut)
def open_letter(
    letter_id: str, db: DbSession, user: CurrentUser, couple: CurrentCouple
) -> LetterOut:
    """Mark a received, unlocked letter as opened and return it with its body."""
    letter = db.get(Letter, letter_id)
    if letter is None or letter.couple_id != couple.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Letter not found")
    if letter.to_user_id != user.id:
        # Only the recipient opens a letter; sender sees their own via the list.
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Letter not found")
    if _as_aware_utc(letter.visible_from) > datetime.now(UTC):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This letter is still locked",
        )
    if not letter.is_opened:
        letter.is_opened = True
        db.commit()
        db.refresh(letter)
    names = _name_map(db, [letter])
    return _to_out(letter, viewer_id=user.id, names=names)
