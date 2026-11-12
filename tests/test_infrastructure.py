from pathlib import Path
import base64
from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta
from threading import Barrier

import pytest
from cryptography.fernet import Fernet

from app.database import engine
from app.backup import decrypt_file, encrypt_file
from app.config import validate_runtime_configuration


def test_login_attempt_limit_is_shared_and_persisted(client):
    payload = {"email": "missing-user@example.test", "password": "not-a-valid-password"}

    for _ in range(10):
        response = client.post("/api/auth/login", json=payload)
        assert response.status_code == 401

    limited = client.post("/api/auth/login", json=payload)
    assert limited.status_code == 429
    assert limited.headers["retry-after"] == "900"


def test_health_readiness_and_security_headers(client):
    live = client.get("/api/health/live")
    ready = client.get("/api/health/ready")

    assert live.status_code == 200
    assert ready.status_code == 200
    assert ready.json()["status"] == "ready"
    assert live.headers["x-content-type-options"] == "nosniff"
    assert live.headers["x-request-id"]


def test_cross_origin_state_change_is_rejected(client):
    response = client.post(
        "/api/auth/logout",
        headers={"Origin": "https://attacker.example"},
    )

    assert response.status_code == 403
    assert response.headers["x-request-id"]


def test_production_configuration_fails_closed(monkeypatch):
    monkeypatch.setenv("SAVESTOCK_ENV", "production")
    monkeypatch.setenv("SAVESTOCK_COOKIE_SECURE", "false")
    monkeypatch.delenv("SAVESTOCK_ALLOWED_HOSTS", raising=False)
    monkeypatch.delenv("SAVESTOCK_SECRET_KEY", raising=False)
    monkeypatch.delenv("BACKUP_ENCRYPTION_KEY", raising=False)

    with pytest.raises(RuntimeError, match="SAVESTOCK_COOKIE_SECURE"):
        validate_runtime_configuration()


def test_production_configuration_accepts_complete_secure_settings(monkeypatch):
    monkeypatch.setenv("SAVESTOCK_ENV", "production")
    monkeypatch.setenv("SAVESTOCK_COOKIE_SECURE", "true")
    monkeypatch.setenv("SAVESTOCK_ALLOWED_HOSTS", "inventory.example.com")
    monkeypatch.setenv("SAVESTOCK_SECRET_KEY", "s" * 48)
    monkeypatch.setenv("BACKUP_ENCRYPTION_KEY", Fernet.generate_key().decode("ascii"))
    monkeypatch.setenv(
        "DATABASE_URL",
        "postgresql+psycopg://savestock:password@localhost/savestock",
    )

    validate_runtime_configuration()


def test_encrypted_backup_round_trip_and_tamper_detection(tmp_path: Path):
    key = base64.urlsafe_b64decode(Fernet.generate_key())
    source = tmp_path / "source.dump"
    encrypted = tmp_path / "source.dump.enc"
    restored = tmp_path / "restored.dump"
    source.write_bytes(b"sample database backup" * 10_000)

    encrypt_file(source, encrypted, key)
    decrypt_file(encrypted, restored, key)
    assert restored.read_bytes() == source.read_bytes()

    damaged = bytearray(encrypted.read_bytes())
    damaged[-1] ^= 1
    encrypted.write_bytes(damaged)
    with pytest.raises(RuntimeError, match="Yedek doğrulanamadı"):
        decrypt_file(encrypted, restored, key)
    assert not restored.exists()


@pytest.mark.skipif(engine.dialect.name != "postgresql", reason="Row-lock concurrency requires PostgreSQL.")
def test_concurrent_stock_out_does_not_oversell(client):
    product_response = client.post(
        "/api/products",
        json={"sku": "LOCK-TEST", "name": "Concurrent stock", "unit": "adet"},
    )
    assert product_response.status_code == 201
    product_id = product_response.json()["id"]
    dealer_id = client.get("/api/dealers").json()[0]["id"]
    inbound = client.post(
        "/api/stock/inbound",
        json={
            "product_id": product_id,
            "dealer_id": dealer_id,
            "batch_code": "LOCK-BATCH",
            "expiry_date": (date.today() + timedelta(days=60)).isoformat(),
            "quantity": 5,
        },
    )
    assert inbound.status_code == 201

    barrier = Barrier(2)

    def issue_four_units():
        barrier.wait()
        return client.post(
            "/api/stock/outbound",
            json={"product_id": product_id, "dealer_id": dealer_id, "quantity": 4},
        )

    with ThreadPoolExecutor(max_workers=2) as executor:
        responses = list(executor.map(lambda _index: issue_four_units(), range(2)))

    assert sorted(response.status_code for response in responses) == [200, 409]
    batches = client.get("/api/batches").json()
    matching_batch = next(batch for batch in batches if batch["batch_code"] == "LOCK-BATCH")
    assert matching_batch["quantity_on_hand"] == 1
