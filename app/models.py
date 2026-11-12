from datetime import date, datetime, timezone
from decimal import Decimal

from sqlalchemy import Boolean, CheckConstraint, Date, DateTime, ForeignKey, Index, Integer, Numeric, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(80), unique=True, nullable=False)


class Dealer(Base):
    __tablename__ = "dealers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), server_default=func.now()
    )


class Product(Base):
    __tablename__ = "products"
    __table_args__ = (
        CheckConstraint("length(trim(sku)) > 0", name="ck_products_sku_not_blank"),
        Index("ix_products_name", "name"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    sku: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    barcode: Mapped[str | None] = mapped_column(String(80), unique=True, nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    unit: Mapped[str] = mapped_column(String(24), nullable=False, default="adet", server_default="adet")
    category_id: Mapped[int | None] = mapped_column(
        ForeignKey("categories.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )


class Batch(Base):
    __tablename__ = "batches"
    __table_args__ = (
        UniqueConstraint("product_id", "dealer_id", "batch_code", name="uq_batches_product_dealer_code"),
        CheckConstraint("quantity_on_hand >= 0", name="ck_batches_quantity_nonnegative"),
        Index("ix_batches_dealer_expiry", "dealer_id", "expiry_date"),
        Index("ix_batches_dealer_product", "dealer_id", "product_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    product_id: Mapped[int] = mapped_column(
        ForeignKey("products.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    dealer_id: Mapped[int] = mapped_column(
        ForeignKey("dealers.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    batch_code: Mapped[str] = mapped_column(String(80), nullable=False)
    expiry_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    quantity_on_hand: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")


class StockMovement(Base):
    __tablename__ = "stock_movements"
    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_movements_quantity_positive"),
        CheckConstraint("movement_type IN ('IN', 'OUT')", name="ck_movements_type"),
        Index("ix_stock_movements_created_at_id", "created_at", "id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    batch_id: Mapped[int] = mapped_column(
        ForeignKey("batches.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    movement_type: Mapped[str] = mapped_column(String(3), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    is_adjustment: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    note: Mapped[str | None] = mapped_column(String(240), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), index=True
    )


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint("role IN ('admin', 'user')", name="ck_users_role"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    full_name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(String(254), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(256), nullable=False)
    role: Mapped[str] = mapped_column(String(16), nullable=False, default="user")
    dealer_id: Mapped[int | None] = mapped_column(
        ForeignKey("dealers.id", ondelete="SET NULL"), nullable=True, index=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), server_default=func.now()
    )


class StockRequest(Base):
    __tablename__ = "stock_requests"
    __table_args__ = (
        CheckConstraint("requested_quantity > 0", name="ck_stock_requests_quantity_positive"),
        CheckConstraint("fulfilled_quantity >= 0", name="ck_stock_requests_fulfilled_nonnegative"),
        CheckConstraint(
            "status IN ('pending', 'partially_fulfilled', 'fulfilled', 'rejected')",
            name="ck_stock_requests_status",
        ),
        Index("ix_stock_requests_dealer_created_id", "dealer_id", "created_at", "id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    dealer_id: Mapped[int] = mapped_column(ForeignKey("dealers.id", ondelete="RESTRICT"), nullable=False, index=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="RESTRICT"), nullable=False, index=True)
    requested_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    requested_quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    fulfilled_quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    source_dealer_id: Mapped[int | None] = mapped_column(ForeignKey("dealers.id", ondelete="SET NULL"), nullable=True)
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="pending", server_default="pending", index=True)
    note: Mapped[str | None] = mapped_column(String(240), nullable=True)
    resolution_note: Mapped[str | None] = mapped_column(String(240), nullable=True)
    reviewed_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), server_default=func.now(), index=True
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class UserSession(Base):
    __tablename__ = "user_sessions"

    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    login_activity_recorded: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), server_default=func.now()
    )


class AuthLoginAttempt(Base):
    __tablename__ = "auth_login_attempts"
    __table_args__ = (Index("ix_auth_login_attempts_window_started", "window_started"),)

    key_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    window_started: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=1, server_default="1")


class UserActivity(Base):
    __tablename__ = "user_activities"
    __table_args__ = (
        CheckConstraint(
            "event_type IN ('LOGIN', 'LOGOUT', 'PROFILE_UPDATE', 'PASSWORD_CHANGE', "
            "'PRODUCT_CREATE', 'PRODUCT_UPDATE', 'CATEGORY_CREATE', 'USER_CREATE', 'USER_ACTIVATE', "
            "'USER_DEACTIVATE', 'DEALER_CREATE', 'STOCK_IN', 'STOCK_OUT', 'STOCK_ADJUSTMENT', "
            "'STOCK_REQUEST_CREATE', 'STOCK_REQUEST_FULFILL', 'STOCK_REQUEST_REJECT', "
            "'BILLING_SUBSCRIPTION_CREATE', 'BILLING_PAYMENT_PAID', 'BILLING_PERIOD_CREATE', "
            "'BILLING_PURCHASE_CREATE')",
            name="ck_user_activities_event_type",
        ),
        Index("ix_user_activities_user_created_id", "user_id", "created_at", "id"),
        Index("ix_user_activities_created_id", "created_at", "id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    event_type: Mapped[str] = mapped_column(String(32), nullable=False)
    description: Mapped[str] = mapped_column(String(240), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), server_default=func.now(), index=True
    )


class BillingSubscription(Base):
    __tablename__ = "billing_subscriptions"
    __table_args__ = (
        CheckConstraint("plan_code IN ('starter', 'growth', 'enterprise')", name="ck_billing_subscriptions_plan"),
        CheckConstraint("monthly_net_amount > 0", name="ck_billing_subscriptions_amount_positive"),
        CheckConstraint("term_months IN (1, 3, 6, 12)", name="ck_billing_subscriptions_term"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    dealer_id: Mapped[int | None] = mapped_column(
        ForeignKey("dealers.id", ondelete="SET NULL"), nullable=True, index=True
    )
    customer_name: Mapped[str] = mapped_column(String(120), nullable=False)
    customer_email: Mapped[str] = mapped_column(String(254), nullable=False, index=True)
    plan_code: Mapped[str] = mapped_column(String(20), nullable=False)
    term_months: Mapped[int] = mapped_column(Integer, nullable=False, default=1, server_default="1")
    monthly_net_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    vat_rate: Mapped[Decimal] = mapped_column(Numeric(4, 2), nullable=False, default=20, server_default="20")
    starts_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    expires_at: Mapped[date | None] = mapped_column(Date, nullable=True, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), server_default=func.now()
    )


class BillingPayment(Base):
    __tablename__ = "billing_payments"
    __table_args__ = (
        UniqueConstraint("subscription_id", "period_start", name="uq_billing_payments_subscription_period"),
        CheckConstraint("status IN ('pending', 'paid', 'failed')", name="ck_billing_payments_status"),
        CheckConstraint("net_amount >= 0 AND vat_amount >= 0 AND total_amount >= 0", name="ck_billing_payments_amounts_nonnegative"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    subscription_id: Mapped[int] = mapped_column(
        ForeignKey("billing_subscriptions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    period_start: Mapped[date] = mapped_column(Date, nullable=False)
    due_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    net_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    vat_rate: Mapped[Decimal] = mapped_column(Numeric(4, 2), nullable=False)
    vat_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    total_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    provider_order_id: Mapped[str | None] = mapped_column(String(64), nullable=True, unique=True, index=True)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="pending", server_default="pending")
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), server_default=func.now(), index=True
    )
