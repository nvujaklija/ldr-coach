"""rituals: templates, scheduling columns, and instances

Revision ID: 0005
Revises: 0004
Create Date: 2026-06-04 13:00:00.000000
"""
import uuid
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0005"
down_revision: str | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


# Mirrors app.services.rituals.DEFAULT_RITUAL_TEMPLATES. Kept inline so the
# migration stays self-contained and reproducible even if the catalog evolves.
_DEFAULT_TEMPLATES = [
    ("movie_night", "Movie Night",
     "Press play at the same time and watch a film together.", "weekly", "🎬"),
    ("game_night", "Game Night",
     "Hop on a call and play your favourite online game.", "weekly", "🎮"),
    ("parallel_walk", "Parallel Walk",
     "Go for a walk at the same time and talk along the way.", "weekly", "🚶"),
    ("cook_together", "Cook Together",
     "Make the same recipe over video and eat together.", "weekly", "🍳"),
    ("morning_coffee", "Morning Coffee",
     "Start the day with a shared coffee on video.", "daily", "☕"),
    ("monthly_date", "Monthly Date Night",
     "A dressed-up virtual date to look forward to each month.", "monthly", "🌹"),
]


def upgrade() -> None:
    # 1. Extend the existing rituals table with scheduling columns.
    with op.batch_alter_table("rituals", schema=None) as batch_op:
        batch_op.add_column(sa.Column("template_key", sa.String(length=50), nullable=True))
        batch_op.add_column(sa.Column("day_of_week", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("day_of_month", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("time_of_day", sa.String(length=5), nullable=True))
        batch_op.add_column(sa.Column("timezone", sa.String(length=64), nullable=True))
        batch_op.add_column(
            sa.Column(
                "status", sa.String(length=20), nullable=False, server_default="active"
            )
        )
        batch_op.alter_column("status", server_default=None)

    # 2. Template catalog.
    op.create_table(
        "ritual_templates",
        sa.Column("key", sa.String(length=50), nullable=False),
        sa.Column("title", sa.String(length=150), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("default_cadence", sa.String(length=40), nullable=False),
        sa.Column("icon", sa.String(length=8), nullable=True),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True),
            server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False,
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True),
            server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("ritual_templates", schema=None) as batch_op:
        batch_op.create_index(
            batch_op.f("ix_ritual_templates_key"), ["key"], unique=True
        )

    # 3. Concrete occurrences.
    op.create_table(
        "ritual_instances",
        sa.Column("ritual_id", sa.String(length=36), nullable=False),
        sa.Column("couple_id", sa.String(length=36), nullable=False),
        sa.Column("scheduled_for", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True),
            server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False,
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True),
            server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False,
        ),
        sa.ForeignKeyConstraint(["ritual_id"], ["rituals.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["couple_id"], ["couples.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("ritual_instances", schema=None) as batch_op:
        batch_op.create_index(
            batch_op.f("ix_ritual_instances_ritual_id"), ["ritual_id"], unique=False
        )
        batch_op.create_index(
            batch_op.f("ix_ritual_instances_couple_id"), ["couple_id"], unique=False
        )

    # 4. Seed the starter catalog.
    templates = sa.table(
        "ritual_templates",
        sa.column("id", sa.String),
        sa.column("key", sa.String),
        sa.column("title", sa.String),
        sa.column("description", sa.Text),
        sa.column("default_cadence", sa.String),
        sa.column("icon", sa.String),
    )
    op.bulk_insert(
        templates,
        [
            {
                "id": str(uuid.uuid4()),
                "key": key,
                "title": title,
                "description": description,
                "default_cadence": cadence,
                "icon": icon,
            }
            for key, title, description, cadence, icon in _DEFAULT_TEMPLATES
        ],
    )


def downgrade() -> None:
    with op.batch_alter_table("ritual_instances", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_ritual_instances_couple_id"))
        batch_op.drop_index(batch_op.f("ix_ritual_instances_ritual_id"))
    op.drop_table("ritual_instances")

    with op.batch_alter_table("ritual_templates", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_ritual_templates_key"))
    op.drop_table("ritual_templates")

    with op.batch_alter_table("rituals", schema=None) as batch_op:
        batch_op.drop_column("status")
        batch_op.drop_column("timezone")
        batch_op.drop_column("time_of_day")
        batch_op.drop_column("day_of_month")
        batch_op.drop_column("day_of_week")
        batch_op.drop_column("template_key")
