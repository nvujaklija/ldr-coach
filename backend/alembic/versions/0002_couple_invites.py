"""couple invites

Revision ID: 0002
Revises: 0001
Create Date: 2026-06-03 16:00:00.000000
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0002'
down_revision: str | None = '0001'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table('couple_invites',
    sa.Column('couple_id', sa.String(length=36), nullable=False),
    sa.Column('code', sa.String(length=32), nullable=False),
    sa.Column('created_by_id', sa.String(length=36), nullable=False),
    sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('accepted_by_id', sa.String(length=36), nullable=True),
    sa.Column('accepted_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
    sa.ForeignKeyConstraint(['couple_id'], ['couples.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['created_by_id'], ['users.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['accepted_by_id'], ['users.id'], ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('couple_invites', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_couple_invites_couple_id'), ['couple_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_couple_invites_code'), ['code'], unique=True)


def downgrade() -> None:
    with op.batch_alter_table('couple_invites', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_couple_invites_code'))
        batch_op.drop_index(batch_op.f('ix_couple_invites_couple_id'))

    op.drop_table('couple_invites')
