"""bereal: user timezone + schedules, moments, posts

Revision ID: 0006
Revises: 0005
Create Date: 2026-06-06 10:00:00.000000
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
    # 1. Each user carries a timezone; existing rows default to UTC.
    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column("timezone", sa.String(length=64), nullable=False, server_default="UTC")
        )
        batch_op.alter_column("timezone", server_default=None)

    # 2. One schedule row per couple (the on/off switch + next moment).
    op.create_table(
        "be_real_schedules",
        sa.Column("couple_id", sa.String(length=36), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("next_utc", sa.DateTime(timezone=True), nullable=True),
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
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("be_real_schedules", schema=None) as batch_op:
        batch_op.create_index(
            batch_op.f("ix_be_real_schedules_couple_id"), ["couple_id"], unique=True
        )

    # 3. Concrete moments.
    op.create_table(
        "be_real_moments",
        sa.Column("couple_id", sa.String(length=36), nullable=False),
        sa.Column("scheduled_utc", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
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
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("be_real_moments", schema=None) as batch_op:
        batch_op.create_index(
            batch_op.f("ix_be_real_moments_couple_id"), ["couple_id"], unique=False
        )

    # 4. Per-partner photos.
    op.create_table(
        "be_real_posts",
        sa.Column("moment_id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("image_url", sa.String(length=500), nullable=False),
        sa.Column("posted_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True),
            server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False,
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True),
            server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False,
        ),
        sa.ForeignKeyConstraint(["moment_id"], ["be_real_moments.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("moment_id", "user_id", name="uq_be_real_post_moment_user"),
    )
    with op.batch_alter_table("be_real_posts", schema=None) as batch_op:
        batch_op.create_index(
            batch_op.f("ix_be_real_posts_moment_id"), ["moment_id"], unique=False
        )
        batch_op.create_index(
            batch_op.f("ix_be_real_posts_user_id"), ["user_id"], unique=False
        )


def downgrade() -> None:
    with op.batch_alter_table("be_real_posts", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_be_real_posts_user_id"))
        batch_op.drop_index(batch_op.f("ix_be_real_posts_moment_id"))
    op.drop_table("be_real_posts")

    with op.batch_alter_table("be_real_moments", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_be_real_moments_couple_id"))
    op.drop_table("be_real_moments")

    with op.batch_alter_table("be_real_schedules", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_be_real_schedules_couple_id"))
    op.drop_table("be_real_schedules")

    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.drop_column("timezone")
