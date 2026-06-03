"""visit status and milestones

Revision ID: 0002
Revises: 0001
Create Date: 2026-06-03 16:00:00.000000
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("visits", schema=None) as batch_op:
        # server_default backfills existing rows; the ORM owns the default
        # going forward, so it is dropped immediately after.
        batch_op.add_column(
            sa.Column(
                "status",
                sa.String(length=20),
                nullable=False,
                server_default="planned",
            )
        )
        batch_op.alter_column("status", server_default=None)

    op.create_table(
        "milestones",
        sa.Column("couple_id", sa.String(length=36), nullable=False),
        sa.Column("visit_id", sa.String(length=36), nullable=True),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["couple_id"], ["couples.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["visit_id"], ["visits.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("milestones", schema=None) as batch_op:
        batch_op.create_index(
            batch_op.f("ix_milestones_couple_id"), ["couple_id"], unique=False
        )
        batch_op.create_index(
            batch_op.f("ix_milestones_visit_id"), ["visit_id"], unique=False
        )


def downgrade() -> None:
    with op.batch_alter_table("milestones", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_milestones_visit_id"))
        batch_op.drop_index(batch_op.f("ix_milestones_couple_id"))

    op.drop_table("milestones")

    with op.batch_alter_table("visits", schema=None) as batch_op:
        batch_op.drop_column("status")
