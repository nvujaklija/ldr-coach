"""notifications: per-user notifications and delivery preferences

Revision ID: 0006
Revises: 0005
Create Date: 2026-06-04 18:00:00.000000
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
        "notifications",
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("type", sa.String(length=40), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("body", sa.Text(), nullable=True),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("trigger_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("dedup_key", sa.String(length=200), nullable=True),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True),
            server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False,
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True),
            server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "dedup_key", name="uq_notification_user_dedup"),
    )
    with op.batch_alter_table("notifications", schema=None) as batch_op:
        batch_op.create_index(
            batch_op.f("ix_notifications_user_id"), ["user_id"], unique=False
        )

    op.create_table(
        "notification_preferences",
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("visit_reminder_days", sa.Integer(), nullable=False),
        sa.Column("visit_reminders_enabled", sa.Boolean(), nullable=False),
        sa.Column("ritual_reminders_enabled", sa.Boolean(), nullable=False),
        sa.Column("in_app_enabled", sa.Boolean(), nullable=False),
        sa.Column("email_enabled", sa.Boolean(), nullable=False),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True),
            server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False,
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True),
            server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("notification_preferences", schema=None) as batch_op:
        batch_op.create_index(
            batch_op.f("ix_notification_preferences_user_id"),
            ["user_id"], unique=True,
        )


def downgrade() -> None:
    with op.batch_alter_table("notification_preferences", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_notification_preferences_user_id"))
    op.drop_table("notification_preferences")

    with op.batch_alter_table("notifications", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_notifications_user_id"))
    op.drop_table("notifications")
