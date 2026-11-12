"""Add indexes for the most common catalog and activity queries."""
from alembic import op
import sqlalchemy as sa

revision = "0004_query_indexes"
down_revision = "0003_login_attempts"
branch_labels = None
depends_on = None

INDEXES = (
    ("auth_login_attempts", "ix_auth_login_attempts_window_started", ("window_started",)),
    ("products", "ix_products_name", ("name",)),
    ("batches", "ix_batches_dealer_expiry", ("dealer_id", "expiry_date")),
    ("batches", "ix_batches_dealer_product", ("dealer_id", "product_id")),
    ("stock_movements", "ix_stock_movements_created_at_id", ("created_at", "id")),
    ("stock_requests", "ix_stock_requests_dealer_created_id", ("dealer_id", "created_at", "id")),
    ("user_activities", "ix_user_activities_user_created_id", ("user_id", "created_at", "id")),
    ("user_activities", "ix_user_activities_created_id", ("created_at", "id")),
)


def upgrade() -> None:
    connection = op.get_bind()
    for table, name, columns in INDEXES:
        existing = {item["name"] for item in sa.inspect(connection).get_indexes(table)}
        if name not in existing:
            op.create_index(name, table, list(columns))


def downgrade() -> None:
    connection = op.get_bind()
    for table, name, _columns in reversed(INDEXES):
        existing = {item["name"] for item in sa.inspect(connection).get_indexes(table)}
        if name in existing:
            op.drop_index(name, table_name=table)
