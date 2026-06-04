"""bucket items

Revision ID: 0006
Revises: 0005
Create Date: 2026-06-04 14:00:00.000000
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0006"
down_revision: str | None = "0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "bucket_items",
        sa.Column("couple_id", sa.String(length=36), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("category", sa.String(length=50), nullable=True),
        sa.Column("target_visit_id", sa.String(length=36), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True),
            server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False,
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True),
            server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False,
        ),
        sa.ForeignKeyConstraint(["couple_id"], ["couples.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["target_visit_id"], ["visits.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("bucket_items", schema=None) as batch_op:
        batch_op.create_index(
            batch_op.f("ix_bucket_items_couple_id"), ["couple_id"], unique=False
        )
        batch_op.create_index(
            batch_op.f("ix_bucket_items_target_visit_id"), ["target_visit_id"], unique=False
        )


def downgrade() -> None:
    with op.batch_alter_table("bucket_items", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_bucket_items_target_visit_id"))
        batch_op.drop_index(batch_op.f("ix_bucket_items_couple_id"))
    op.drop_table("bucket_items")
