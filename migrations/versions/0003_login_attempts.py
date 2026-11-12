"""Add a durable login-attempt counter for rate limiting."""
from alembic import op
import sqlalchemy as sa

revision = "0003_login_attempts"
down_revision = "0002_pg_legacy"
branch_labels = None
depends_on = None


def upgrade() -> None:
    if "auth_login_attempts" not in sa.inspect(op.get_bind()).get_table_names():
        op.create_table(
            "auth_login_attempts",
            sa.Column("key_hash", sa.String(length=64), primary_key=True),
            sa.Column("window_started", sa.DateTime(timezone=True), nullable=False),
            sa.Column("attempts", sa.Integer(), server_default="1", nullable=False),
        )


def downgrade() -> None:
    op.drop_table("auth_login_attempts")
