"""letters and memory timeline

Revision ID: 0007
Revises: 0006
Create Date: 2026-06-04 14:00:00.000000
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0007"
down_revision: str | None = "0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Time-released letters between partners.
    op.create_table(
        "letters",
        sa.Column("couple_id", sa.String(length=36), nullable=False),
        sa.Column("from_user_id", sa.String(length=36), nullable=False),
        sa.Column("to_user_id", sa.String(length=36), nullable=False),
        sa.Column("visible_from", sa.DateTime(timezone=True), nullable=False),
        sa.Column("title", sa.String(length=150), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("is_opened", sa.Boolean(), nullable=False),
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
        sa.ForeignKeyConstraint(["from_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["to_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("letters", schema=None) as batch_op:
        batch_op.create_index(
            batch_op.f("ix_letters_couple_id"), ["couple_id"], unique=False
        )
        batch_op.create_index(
            batch_op.f("ix_letters_from_user_id"), ["from_user_id"], unique=False
        )
        batch_op.create_index(
            batch_op.f("ix_letters_to_user_id"), ["to_user_id"], unique=False
        )

    # Shared memory timeline.
    op.create_table(
        "memory_items",
        sa.Column("couple_id", sa.String(length=36), nullable=False),
        sa.Column("created_by_id", sa.String(length=36), nullable=True),
        sa.Column("type", sa.String(length=20), nullable=False),
        sa.Column("data", sa.JSON(), nullable=False),
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
        sa.ForeignKeyConstraint(["created_by_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("memory_items", schema=None) as batch_op:
        batch_op.create_index(
            batch_op.f("ix_memory_items_couple_id"), ["couple_id"], unique=False
        )


def downgrade() -> None:
    with op.batch_alter_table("memory_items", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_memory_items_couple_id"))
    op.drop_table("memory_items")

    with op.batch_alter_table("letters", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_letters_to_user_id"))
        batch_op.drop_index(batch_op.f("ix_letters_from_user_id"))
        batch_op.drop_index(batch_op.f("ix_letters_couple_id"))
    op.drop_table("letters")
