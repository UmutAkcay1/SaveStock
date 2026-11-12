from datetime import UTC, datetime

from app.database import SessionLocal
from app.models import UserActivity


def test_user_list_includes_latest_login_and_logout_timestamps(client):
    user_response = client.post(
        "/api/users",
        json={
            "full_name": "Bayi Kullanıcısı",
            "email": "branch@example.test",
            "password": "branch-password-123",
            "role": "user",
            "dealer_id": client.get("/api/dealers").json()[0]["id"],
        },
    )
    assert user_response.status_code == 201

    login_times = [
        datetime(2026, 10, 10, 9, tzinfo=UTC),
        datetime(2026, 10, 12, 11, tzinfo=UTC),
    ]
    logout_time = datetime(2026, 10, 12, 15, tzinfo=UTC)
    with SessionLocal() as db:
        db.add_all(
            [
                UserActivity(
                    user_id=user_response.json()["id"],
                    event_type="LOGIN",
                    description="Test login",
                    created_at=login_times[0],
                ),
                UserActivity(
                    user_id=user_response.json()["id"],
                    event_type="LOGIN",
                    description="Test login",
                    created_at=login_times[1],
                ),
                UserActivity(
                    user_id=user_response.json()["id"],
                    event_type="LOGOUT",
                    description="Test logout",
                    created_at=logout_time,
                ),
            ]
        )
        db.commit()

    users_response = client.get("/api/users")
    assert users_response.status_code == 200
    rows = {user["id"]: user for user in users_response.json()}
    user = rows[user_response.json()["id"]]
    assert user["last_login_at"] == "2026-10-12T11:00:00"
    assert user["last_logout_at"] == "2026-10-12T15:00:00"

    admin = rows[client.get("/api/profile").json()["id"]]
    assert admin["last_login_at"] is not None
    assert admin["last_logout_at"] is None


def test_standard_user_can_open_product_add_page_and_create_product(client):
    dealer_id = client.get("/api/dealers").json()[0]["id"]
    user_response = client.post(
        "/api/users",
        json={
            "full_name": "Bayi Kullanıcısı",
            "email": "product-user@example.test",
            "password": "branch-password-123",
            "role": "user",
            "dealer_id": dealer_id,
        },
    )
    assert user_response.status_code == 201
    assert client.post("/api/auth/logout").status_code == 200

    login = client.post(
        "/api/auth/login",
        json={"email": "product-user@example.test", "password": "branch-password-123"},
    )
    assert login.status_code == 200

    product_response = client.post(
        "/api/products",
        json={"sku": "USER-SKU-001", "name": "Kullanıcı ürünü"},
    )
    assert product_response.status_code == 201
    assert product_response.json()["name"] == "Kullanıcı ürünü"
    assert any(product["sku"] == "USER-SKU-001" for product in client.get("/api/products").json())
