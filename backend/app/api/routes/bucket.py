"""Bucket-list routes: a couple's shared wishlist of things to do together.

Endpoints:
    GET   /bucket-items        list the couple's items
    POST  /bucket-items        add an item (optionally linked to a visit)
    PATCH /bucket-items/{id}    update title/category/status/notes/visit link
"""

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.api.deps import CurrentCouple, DbSession
from app.models import BucketItem, Visit
from app.schemas.bucket_item import BucketItemCreate, BucketItemOut, BucketItemUpdate

router = APIRouter(prefix="/bucket-items", tags=["bucket-items"])


def _assert_visit_in_couple(db: DbSession, visit_id: str, couple_id: str) -> None:
    visit = db.get(Visit, visit_id)
    if visit is None or visit.couple_id != couple_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Visit not found")


@router.get("", response_model=list[BucketItemOut])
def list_bucket_items(db: DbSession, couple: CurrentCouple) -> list[BucketItem]:
    stmt = (
        select(BucketItem)
        .where(BucketItem.couple_id == couple.id)
        .order_by(BucketItem.created_at.asc())
    )
    return list(db.scalars(stmt))


@router.post("", response_model=BucketItemOut, status_code=status.HTTP_201_CREATED)
def create_bucket_item(
    payload: BucketItemCreate, db: DbSession, couple: CurrentCouple
) -> BucketItem:
    if payload.target_visit_id is not None:
        _assert_visit_in_couple(db, payload.target_visit_id, couple.id)
    item = BucketItem(
        couple_id=couple.id,
        title=payload.title,
        category=payload.category,
        target_visit_id=payload.target_visit_id,
        notes=payload.notes,
        status="planned",
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.patch("/{item_id}", response_model=BucketItemOut)
def update_bucket_item(
    item_id: str, payload: BucketItemUpdate, db: DbSession, couple: CurrentCouple
) -> BucketItem:
    item = db.get(BucketItem, item_id)
    if item is None or item.couple_id != couple.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bucket item not found")
    data = payload.model_dump(exclude_unset=True)
    if data.get("target_visit_id") is not None:
        _assert_visit_in_couple(db, data["target_visit_id"], couple.id)
    for field, value in data.items():
        setattr(item, field, value)
    db.commit()
    db.refresh(item)
    return item
