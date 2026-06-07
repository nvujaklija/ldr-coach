"""settings & profile: user prefs and shared couple settings

Revision ID: 0009
Revises: 0008
Create Date: 2026-06-04 14:00:00.000000
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0009"
down_revision: str | None = "0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Per-user preferences. Server defaults backfill existing rows; we then
    # drop the default so the application layer owns the value going forward.
    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column(
                "timezone", sa.String(length=64), nullable=False, server_default="UTC"
            )
        )
        batch_op.add_column(
            sa.Column(
                "theme", sa.String(length=20), nullable=False, server_default="system"
            )
        )
        batch_op.add_column(
            sa.Column(
                "notify_checkin_reminders",
                sa.Boolean(), nullable=False, server_default=sa.text("1"),
            )
        )
        batch_op.add_column(
            sa.Column(
                "notify_visit_reminders",
                sa.Boolean(), nullable=False, server_default=sa.text("1"),
            )
        )
        batch_op.add_column(
            sa.Column(
                "notify_ritual_reminders",
                sa.Boolean(), nullable=False, server_default=sa.text("1"),
            )
        )
        batch_op.alter_column("timezone", server_default=None)
        batch_op.alter_column("theme", server_default=None)
        batch_op.alter_column("notify_checkin_reminders", server_default=None)
        batch_op.alter_column("notify_visit_reminders", server_default=None)
        batch_op.alter_column("notify_ritual_reminders", server_default=None)

    # Shared couple settings.
    with op.batch_alter_table("couples", schema=None) as batch_op:
        batch_op.add_column(sa.Column("relationship_start_date", sa.Date(), nullable=True))
        batch_op.add_column(
            sa.Column("show_visits", sa.Boolean(), nullable=False, server_default=sa.text("1"))
        )
        batch_op.add_column(
            sa.Column("show_rituals", sa.Boolean(), nullable=False, server_default=sa.text("1"))
        )
        batch_op.add_column(
            sa.Column("show_checkins", sa.Boolean(), nullable=False, server_default=sa.text("1"))
        )
        batch_op.alter_column("show_visits", server_default=None)
        batch_op.alter_column("show_rituals", server_default=None)
        batch_op.alter_column("show_checkins", server_default=None)


def downgrade() -> None:
    with op.batch_alter_table("couples", schema=None) as batch_op:
        batch_op.drop_column("show_checkins")
        batch_op.drop_column("show_rituals")
        batch_op.drop_column("show_visits")
        batch_op.drop_column("relationship_start_date")

    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.drop_column("notify_ritual_reminders")
        batch_op.drop_column("notify_visit_reminders")
        batch_op.drop_column("notify_checkin_reminders")
        batch_op.drop_column("theme")
        batch_op.drop_column("timezone")
