"""Memory-timeline routes: the couple's shared, paged history of moments.

Endpoints:
    GET   /memories?limit=&offset=     newest-first page of the timeline
    POST  /memories                     add a memory by hand

Memories are also written automatically by other slices via
``app.services.memories`` when a visit/milestone/ritual is completed.
"""

from fastapi import APIRouter, Query, status
from sqlalchemy import select

from app.api.deps import CurrentCouple, CurrentUser, DbSession
from app.models import MemoryItem
from app.schemas.memory import MemoryCreate, MemoryOut
from app.services import memories as memory_service

router = APIRouter(prefix="/memories", tags=["memories"])


@router.get("", response_model=list[MemoryOut])
def list_memories(
    db: DbSession,
    couple: CurrentCouple,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> list[MemoryItem]:
    """A newest-first page of the couple's timeline."""
    stmt = (
        select(MemoryItem)
        .where(MemoryItem.couple_id == couple.id)
        .order_by(MemoryItem.created_at.desc(), MemoryItem.id.desc())
        .limit(limit)
        .offset(offset)
    )
    return list(db.scalars(stmt))


@router.post("", response_model=MemoryOut, status_code=status.HTTP_201_CREATED)
def create_memory(
    payload: MemoryCreate, db: DbSession, user: CurrentUser, couple: CurrentCouple
) -> MemoryItem:
    item = memory_service.record_memory(
        db,
        couple_id=couple.id,
        type=payload.type,
        data=payload.data,
        created_by_id=user.id,
    )
    db.commit()
    db.refresh(item)
    return item
