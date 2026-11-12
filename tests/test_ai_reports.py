import json
from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient

from app import main as app_main


@pytest.fixture(autouse=True)
def reset_ai_report_cooldown():
    app_main._ai_report_last_request.clear()
    yield
    app_main._ai_report_last_request.clear()


def test_ai_report_requires_server_side_api_key(client, monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)

    response = client.post("/api/reports/ai-insights", json={})

    assert response.status_code == 503
    assert "OPENAI_API_KEY" in response.json()["detail"]


def create_transfer_report_data(client):
    dealer_rows = client.get("/api/dealers").json()
    target_dealer_id = dealer_rows[0]["id"]
    source_response = client.post("/api/dealers", json={"name": "Kaynak Bayi"})
    assert source_response.status_code == 201
    source_dealer_id = source_response.json()["id"]
    product_response = client.post(
        "/api/products",
        json={"sku": "AI-SKU-001", "name": "AI Test Ürünü", "unit": "adet"},
    )
    assert product_response.status_code == 201
    product_id = product_response.json()["id"]
    expiry_date = (date.today() + timedelta(days=90)).isoformat()
    for dealer_id, quantity, batch_code in [
        (target_dealer_id, 40, "AI-TARGET"),
        (source_dealer_id, 100, "AI-SOURCE"),
    ]:
        inbound = client.post(
            "/api/stock/inbound",
            json={
                "product_id": product_id,
                "dealer_id": dealer_id,
                "batch_code": batch_code,
                "expiry_date": expiry_date,
                "quantity": quantity,
            },
        )
        assert inbound.status_code == 201
    for dealer_id in [target_dealer_id, source_dealer_id]:
        for index in range(3):
            outbound = client.post(
                "/api/stock/outbound",
                json={"product_id": product_id, "dealer_id": dealer_id, "quantity": 10},
            )
            assert outbound.status_code == 200
    transfer_outbound = client.post(
        "/api/stock/outbound",
        json={
            "product_id": product_id,
            "dealer_id": target_dealer_id,
            "quantity": 1,
            "note": "Stok talebi #500",
        },
    )
    assert transfer_outbound.status_code == 200
    return product_id, target_dealer_id, source_dealer_id


class FakeOpenAIResponse:
    def __init__(self, payload):
        self.payload = payload

    def raise_for_status(self):
        return None

    def json(self):
        return self.payload


class FakeOpenAIClient:
    def __init__(self, response_payload, captured_requests):
        self.response_payload = response_payload
        self.captured_requests = captured_requests

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_value, traceback):
        return None

    async def post(self, url, headers, json):
        self.captured_requests.append({"url": url, "headers": headers, "request": json})
        return FakeOpenAIResponse(self.response_payload)


@pytest.mark.parametrize(
    "suggested_quantity,malformed_source,expected_status",
    [(15, False, 200), (22, False, 502), (15, True, 502)],
)
def test_ai_transfer_is_server_bounded(
    client, monkeypatch, suggested_quantity, malformed_source, expected_status
):
    product_id, target_id, source_id = create_transfer_report_data(client)
    monkeypatch.setenv("OPENAI_API_KEY", "test-server-key")
    captured = []
    generated = {
        "summary": "Kaynak bayinin stok fazlası alıcı bayiye destek olabilir.",
        "recommendations": [
            {
                "type": "transfer",
                "priority": "high",
                "product_id": product_id,
                "dealer_id": target_id,
                "source_dealer_id": [source_id] if malformed_source else source_id,
                "destination_dealer_id": target_id,
                "suggested_quantity": suggested_quantity,
                "confidence": "medium",
                "reason": "Alıcı bayinin stok kapsamı düşük.",
                "evidence": "Son 30 günlük çıkış toplamı ve güvenli stok karşılaştırıldı.",
            }
        ],
    }
    response_payload = {"choices": [{"message": {"content": json.dumps(generated)}}]}
    monkeypatch.setattr(
        app_main.httpx,
        "AsyncClient",
        lambda **kwargs: FakeOpenAIClient(response_payload, captured),
    )

    response = client.post("/api/reports/ai-insights", json={})

    assert response.status_code == expected_status
    assert len(captured) == 1
    sent_data = json.loads(captured[0]["request"]["messages"][1]["content"])
    assert captured[0]["url"] == "https://api.openai.com/v1/chat/completions"
    assert captured[0]["headers"]["Authorization"] == "Bearer test-server-key"
    assert sent_data["eligible_transfer_options"][0]["maximum_quantity"] == 21
    destination_data = next(
        item for item in sent_data["inventory_and_demand"]
        if item["dealer_id"] == target_id
    )
    assert destination_data["outbound_30d"] == 30
    assert destination_data["movement_count_30d"] == 3
    assert "note" not in destination_data
    if expected_status == 200:
        recommendation = response.json()["recommendations"][0]
        assert recommendation["suggested_quantity"] == 15
        assert recommendation["source_dealer_name"] == "Kaynak Bayi"
        cooldown_response = client.post("/api/reports/ai-insights", json={})
        assert cooldown_response.status_code == 429
        assert len(captured) == 1
    else:
        assert "güvenli transfer sınırlarını" in response.json()["detail"]


def test_branch_user_ai_snapshot_does_not_include_other_dealers(
    client, monkeypatch
):
    product_id, target_id, source_id = create_transfer_report_data(client)
    create_user = client.post(
        "/api/users",
        json={
            "full_name": "Bayi Kullanıcısı",
            "email": "branch@example.test",
            "password": "branch-password-123",
            "role": "user",
            "dealer_id": target_id,
        },
    )
    assert create_user.status_code == 201
    monkeypatch.setenv("OPENAI_API_KEY", "test-server-key")
    captured = []
    generated = {
        "summary": "Transfer adayı bulundu.",
        "recommendations": [
            {
                "type": "transfer",
                "priority": "medium",
                "product_id": product_id,
                "dealer_id": target_id,
                "source_dealer_id": source_id,
                "destination_dealer_id": target_id,
                "suggested_quantity": 1,
                "confidence": "low",
                "reason": "Test transferi.",
                "evidence": "Test verisi.",
            }
        ],
    }
    monkeypatch.setattr(
        app_main.httpx,
        "AsyncClient",
        lambda **kwargs: FakeOpenAIClient(
            {"choices": [{"message": {"content": json.dumps(generated)}}]},
            captured,
        ),
    )

    with TestClient(app_main.app) as branch_client:
        login = branch_client.post(
            "/api/auth/login",
            json={"email": "branch@example.test", "password": "branch-password-123"},
        )
        assert login.status_code == 200
        response = branch_client.post("/api/reports/ai-insights", json={})

    assert response.status_code == 502
    sent_data = json.loads(captured[0]["request"]["messages"][1]["content"])
    assert sent_data["can_recommend_cross_dealer_transfers"] is False
    assert sent_data["eligible_transfer_options"] == []
    assert all(item["dealer_id"] == target_id for item in sent_data["inventory_and_demand"])
    assert all(item["dealer_name"] != "Kaynak Bayi" for item in sent_data["inventory_and_demand"])
