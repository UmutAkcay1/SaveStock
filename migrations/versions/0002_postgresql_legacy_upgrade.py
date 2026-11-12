"""Upgrade pre-Alembic PostgreSQL installations without replacing data."""
from alembic import op

revision = "0002_pg_legacy"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    connection = op.get_bind()
    if connection.dialect.name != "postgresql":
        return

    statements = (
        "ALTER TABLE products ADD COLUMN IF NOT EXISTS barcode VARCHAR(80)",
        "CREATE UNIQUE INDEX IF NOT EXISTS ix_products_barcode ON products(barcode)",
        "ALTER TABLE batches ADD COLUMN IF NOT EXISTS dealer_id INTEGER REFERENCES dealers(id) ON DELETE RESTRICT",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS dealer_id INTEGER REFERENCES dealers(id) ON DELETE SET NULL",
        "ALTER TABLE dealers ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE",
        "INSERT INTO dealers (name) VALUES ('Merkez Depo') ON CONFLICT (name) DO NOTHING",
        "UPDATE batches SET dealer_id = (SELECT id FROM dealers WHERE name = 'Merkez Depo') WHERE dealer_id IS NULL",
        "UPDATE users SET dealer_id = (SELECT id FROM dealers WHERE name = 'Merkez Depo') WHERE role = 'user' AND dealer_id IS NULL",
        "ALTER TABLE batches ALTER COLUMN dealer_id SET NOT NULL",
        "ALTER TABLE batches DROP CONSTRAINT IF EXISTS uq_batches_product_code",
        """
        DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_batches_product_dealer_code') THEN
                ALTER TABLE batches ADD CONSTRAINT uq_batches_product_dealer_code
                    UNIQUE (product_id, dealer_id, batch_code);
            END IF;
        END $$
        """,
        "CREATE INDEX IF NOT EXISTS ix_batches_dealer_id ON batches(dealer_id)",
        "CREATE INDEX IF NOT EXISTS ix_users_dealer_id ON users(dealer_id)",
        "ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS login_activity_recorded BOOLEAN NOT NULL DEFAULT FALSE",
        "ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE SET NULL",
        "ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS is_adjustment BOOLEAN NOT NULL DEFAULT FALSE",
        "CREATE INDEX IF NOT EXISTS ix_stock_movements_user_id ON stock_movements(user_id)",
        "ALTER TABLE user_activities DROP CONSTRAINT IF EXISTS ck_user_activities_event_type",
        """
        ALTER TABLE user_activities ADD CONSTRAINT ck_user_activities_event_type CHECK (event_type IN (
            'LOGIN', 'LOGOUT', 'PROFILE_UPDATE', 'PASSWORD_CHANGE', 'PRODUCT_CREATE', 'PRODUCT_UPDATE',
            'CATEGORY_CREATE', 'USER_CREATE', 'USER_ACTIVATE', 'USER_DEACTIVATE', 'DEALER_CREATE',
            'STOCK_IN', 'STOCK_OUT', 'STOCK_ADJUSTMENT', 'STOCK_REQUEST_CREATE', 'STOCK_REQUEST_FULFILL',
            'STOCK_REQUEST_REJECT', 'BILLING_SUBSCRIPTION_CREATE', 'BILLING_PAYMENT_PAID',
            'BILLING_PERIOD_CREATE', 'BILLING_PURCHASE_CREATE'
        ))
        """,
        "ALTER TABLE billing_subscriptions ADD COLUMN IF NOT EXISTS dealer_id INTEGER REFERENCES dealers(id) ON DELETE SET NULL",
        "ALTER TABLE billing_subscriptions ADD COLUMN IF NOT EXISTS term_months INTEGER NOT NULL DEFAULT 1",
        "ALTER TABLE billing_subscriptions ADD COLUMN IF NOT EXISTS starts_at DATE",
        "ALTER TABLE billing_subscriptions ADD COLUMN IF NOT EXISTS expires_at DATE",
        "CREATE INDEX IF NOT EXISTS ix_billing_subscriptions_dealer_id ON billing_subscriptions(dealer_id)",
        "CREATE INDEX IF NOT EXISTS ix_billing_subscriptions_expires_at ON billing_subscriptions(expires_at)",
        "ALTER TABLE billing_payments ADD COLUMN IF NOT EXISTS provider_order_id VARCHAR(64)",
        "ALTER TABLE billing_payments DROP CONSTRAINT IF EXISTS ck_billing_payments_status",
        "UPDATE billing_payments SET status = 'failed' WHERE status = 'pending' AND provider_order_id IS NULL",
        "ALTER TABLE billing_payments ADD CONSTRAINT ck_billing_payments_status CHECK (status IN ('pending', 'paid', 'failed'))",
        "CREATE UNIQUE INDEX IF NOT EXISTS ix_billing_payments_provider_order_id ON billing_payments(provider_order_id) WHERE provider_order_id IS NOT NULL",
    )
    for statement in statements:
        connection.exec_driver_sql(statement)


def downgrade() -> None:
    pass
