from datetime import date
from typing import Literal

from pydantic import BaseModel, Field


class CategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)


class ProductCreate(BaseModel):
    sku: str = Field(min_length=1, max_length=64)
    barcode: str | None = Field(default=None, max_length=80)
    name: str = Field(min_length=1, max_length=160)
    unit: str = Field(default="adet", min_length=1, max_length=24)
    category_id: int | None = None


class ProductUpdate(ProductCreate):
    pass


class InboundCreate(BaseModel):
    product_id: int
    dealer_id: int
    batch_code: str = Field(min_length=1, max_length=80)
    expiry_date: date
    quantity: int = Field(gt=0)
    note: str | None = Field(default=None, max_length=240)


class OutboundCreate(BaseModel):
    product_id: int
    dealer_id: int
    quantity: int = Field(gt=0)
    note: str | None = Field(default=None, max_length=240)


class StockAdjustmentCreate(BaseModel):
    product_id: int
    dealer_id: int
    batch_code: str = Field(min_length=1, max_length=80)
    target_quantity: int = Field(ge=0)
    reason: str = Field(min_length=3, max_length=180)


class StockRequestCreate(BaseModel):
    dealer_id: int | None = None
    product_id: int
    requested_quantity: int = Field(gt=0)
    note: str | None = Field(default=None, max_length=240)


class StockRequestResolve(BaseModel):
    action: Literal["fulfill", "reject"]
    source_dealer_id: int | None = None
    fulfilled_quantity: int = Field(default=0, ge=0)
    resolution_note: str | None = Field(default=None, max_length=240)


class FirstAdminCreate(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    email: str = Field(min_length=5, max_length=254)
    password: str = Field(min_length=10, max_length=128)


class LoginRequest(BaseModel):
    email: str = Field(min_length=5, max_length=254)
    password: str = Field(min_length=1, max_length=128)


class UserCreate(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    email: str = Field(min_length=5, max_length=254)
    password: str = Field(min_length=10, max_length=128)
    role: Literal["admin", "user"]
    dealer_id: int | None = None


class DealerCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)


class UserActiveUpdate(BaseModel):
    is_active: bool


class BillingPurchaseCreate(BaseModel):
    dealer_id: int | None = None
    plan_code: Literal["starter", "growth"]
    term_months: Literal[1, 3, 6, 12]


class ProfileUpdate(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)


class PasswordChange(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=10, max_length=128)
