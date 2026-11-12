import json
from datetime import date, timedelta
from decimal import Decimal

from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.models import BillingPayment, BillingSubscription
from savestock_control import main as control


def test_control_setup_login_overview_and_logout(tmp_path, monkeypatch):
    monkeypatch.setattr(control, "control_home", lambda: tmp_path)
    control._sessions.clear()
    control._login_attempts.clear()
    client = TestClient(control.app, base_url="http://127.0.0.1:8500", client=("127.0.0.1", 12345))

    response = client.get("/api/session")
    assert response.status_code == 200
    assert response.json() == {
        "authenticated": False,
        "username": None,
        "setup_required": True,
        "network_access": False,
    }

    credentials = {"username": "developer", "password": "a-strong-developer-password"}
    response = client.post("/api/setup", json=credentials)
    assert response.status_code == 200
    stored_config = json.loads((tmp_path / "control.json").read_text(encoding="utf-8"))
    assert stored_config["username"] == credentials["username"]
    assert stored_config["password_hash"] != credentials["password"]
    assert len(stored_config["password_hash"]) == 64

    assert client.post("/api/setup", json=credentials).status_code == 409
    assert client.get("/api/overview").status_code == 401
    response = client.post("/api/login", json=credentials)
    assert response.status_code == 200
    assert response.cookies.get(control.SESSION_COOKIE)
    assert response.headers["set-cookie"].lower().find("httponly") >= 0

    response = client.get("/api/overview")
    assert response.status_code == 200
    assert response.json()["status"] == "ready"
    assert response.json()["counts"] == {
        "products": 0,
        "categories": 0,
        "dealers": 0,
        "users": 0,
        "active_users": 0,
        "stock_units": 0,
        "subscriptions": 0,
        "active_subscriptions": 0,
        "expired_subscriptions": 0,
        "expiring_subscriptions": 0,
        "overdue_payments": 0,
    }
    assert response.json()["alerts"] == []

    assert client.post("/api/logout").status_code == 200
    assert client.get("/api/overview").status_code == 401


def test_control_rejects_remote_access_and_malformed_setup(tmp_path, monkeypatch):
    monkeypatch.setattr(control, "control_home", lambda: tmp_path)
    remote_client = TestClient(
        control.app, base_url="http://127.0.0.1:8500", client=("192.0.2.2", 12345)
    )

    assert remote_client.get("/api/session").status_code == 403

    rebinding_client = TestClient(
        control.app, base_url="http://attacker.example", client=("127.0.0.1", 12345)
    )
    assert rebinding_client.get("/api/session").status_code == 403

    local_client = TestClient(
        control.app, base_url="http://127.0.0.1:8500", client=("127.0.0.1", 12345)
    )
    assert local_client.post("/api/setup", json=[]).status_code == 422
    assert local_client.post(
        "/api/setup", json={"username": "developer", "password": "too-short"}
    ).status_code == 422


def test_control_limits_repeated_login_attempts(tmp_path, monkeypatch):
    monkeypatch.setattr(control, "control_home", lambda: tmp_path)
    control._sessions.clear()
    control._login_attempts.clear()
    client = TestClient(control.app, base_url="http://127.0.0.1:8500", client=("127.0.0.1", 12345))
    client.post("/api/setup", json={"username": "developer", "password": "a-strong-developer-password"})

    for _ in range(control.LOGIN_ATTEMPT_LIMIT):
        assert client.post("/api/login", json={"username": "wrong", "password": "wrong"}).status_code == 401
    assert client.post("/api/login", json={"username": "another", "password": "wrong"}).status_code == 429


def test_control_menu_lists_dashboard_and_planned_tools():
    client = TestClient(control.app, base_url="http://127.0.0.1:8500", client=("127.0.0.1", 12345))

    response = client.get("/")

    assert response.status_code == 200
    assert 'id="menu-toggle"' in response.text
    menu_toggle = response.text.split('id="menu-toggle"', 1)[1].split("</button>", 1)[0]
    assert menu_toggle.count("<span></span>") == 3
    assert 'id="control-sidebar"' in response.text
    assert response.text.index('id="control-sidebar"') < response.text.index('id="logout-button"')
    assert 'id="sidebar-developer-name"' in response.text
    for page in ("overview", "status", "customers", "backups", "subscriptions", "audit", "tools"):
        assert f'data-page="{page}"' in response.text
    assert response.text.count("Planlandı") == 6


def test_overview_reports_expiring_subscriptions_and_overdue_payments(tmp_path, monkeypatch):
    monkeypatch.setattr(control, "control_home", lambda: tmp_path)
    control._sessions.clear()
    control._login_attempts.clear()
    client = TestClient(control.app, base_url="http://127.0.0.1:8500", client=("127.0.0.1", 12345))
    credentials = {"username": "developer", "password": "a-strong-developer-password"}
    assert client.post("/api/setup", json=credentials).status_code == 200
    assert client.post("/api/login", json=credentials).status_code == 200

    with SessionLocal() as db:
        subscription = BillingSubscription(
            customer_name="Demo",
            customer_email="demo@example.test",
            plan_code="starter",
            monthly_net_amount=Decimal("499.00"),
            expires_at=date.today() + timedelta(days=10),
            is_active=True,
        )
        db.add(subscription)
        db.flush()
        db.add(BillingPayment(
            subscription_id=subscription.id,
            period_start=date.today() - timedelta(days=40),
            due_date=date.today() - timedelta(days=10),
            net_amount=Decimal("499.00"),
            vat_rate=Decimal(20),
            vat_amount=Decimal("99.80"),
            total_amount=Decimal("598.80"),
            status="pending",
        ))
        db.commit()

    response = client.get("/api/overview")

    assert response.status_code == 200
    data = response.json()
    assert data["counts"]["active_subscriptions"] == 1
    assert data["counts"]["expiring_subscriptions"] == 1
    assert data["counts"]["overdue_payments"] == 1
    assert [alert["key"] for alert in data["alerts"]] == ["overdue-payments", "expiring-subscriptions"]


def test_control_can_be_limited_to_configured_lan_and_host(tmp_path, monkeypatch):
    monkeypatch.setattr(control, "control_home", lambda: tmp_path)
    monkeypatch.setenv("SAVESTOCK_CONTROL_ALLOWED_NETWORK", "172.20.10.0/28")
    monkeypatch.setenv("SAVESTOCK_CONTROL_ALLOWED_HOSTS", "172.20.10.9")

    lan_client = TestClient(
        control.app,
        base_url="http://172.20.10.9:8500",
        client=("172.20.10.4", 12345),
    )
    assert lan_client.get("/api/session").status_code == 200
    assert lan_client.get("/api/session").json()["network_access"] is True
    assert lan_client.post(
        "/api/setup", json={"username": "developer", "password": "a-strong-developer-password"}
    ).status_code == 403

    outside_client = TestClient(
        control.app,
        base_url="http://172.20.10.9:8500",
        client=("172.20.11.4", 12345),
    )
    assert outside_client.get("/api/session").status_code == 403

    rebinding_client = TestClient(
        control.app,
        base_url="http://attacker.example:8500",
        client=("172.20.10.4", 12345),
    )
    assert rebinding_client.get("/api/session").status_code == 403
