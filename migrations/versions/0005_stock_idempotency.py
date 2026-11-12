"""Add replay-safe stock operation records."""
from alembic import op
import sqlalchemy as sa

revision = "0005_stock_idempotency"
down_revision = "0004_query_indexes"
branch_labels = None
depends_on = None


def upgrade() -> None:
    if "stock_idempotency_records" not in sa.inspect(op.get_bind()).get_table_names():
        op.create_table(
            "stock_idempotency_records",
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("key", sa.String(length=128), nullable=False),
            sa.Column("payload_hash", sa.String(length=64), nullable=False),
            sa.Column("response_body", sa.JSON(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("user_id", "key"),
        )


def downgrade() -> None:
    op.drop_table("stock_idempotency_records")
