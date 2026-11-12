from datetime import date, timedelta


def create_product(client):
    response = client.post(
        "/api/products",
        json={"sku": "SKU-001", "name": "Test Ürünü", "unit": "adet"},
    )
    assert response.status_code == 201
    return response.json()["id"]


def default_dealer_id(client):
    response = client.get("/api/dealers")
    assert response.status_code == 200
    return response.json()[0]["id"]


def test_fifo_uses_earliest_expiring_batch_first(client):
    product_id = create_product(client)
    dealer_id = default_dealer_id(client)
    soon = date.today() + timedelta(days=45)
    later = date.today() + timedelta(days=90)

    client.post(
        "/api/stock/inbound",
        json={"product_id": product_id, "dealer_id": dealer_id, "batch_code": "LOT-EARLY", "expiry_date": soon.isoformat(), "quantity": 3},
    )
    client.post(
        "/api/stock/inbound",
        json={"product_id": product_id, "dealer_id": dealer_id, "batch_code": "LOT-LATE", "expiry_date": later.isoformat(), "quantity": 4},
    )

    response = client.post(
        "/api/stock/outbound",
        json={"product_id": product_id, "dealer_id": dealer_id, "quantity": 5},
    )

    assert response.status_code == 200
    assert response.json()["allocations"] == [
        {"batch_code": "LOT-EARLY", "quantity": 3},
        {"batch_code": "LOT-LATE", "quantity": 2},
    ]
    batches = client.get("/api/batches").json()
    assert [(item["batch_code"], item["quantity_on_hand"]) for item in batches] == [("LOT-LATE", 2)]


def test_insufficient_stock_does_not_partially_change_batches(client):
    product_id = create_product(client)
    dealer_id = default_dealer_id(client)
    expiry = date.today() + timedelta(days=60)
    client.post(
        "/api/stock/inbound",
        json={"product_id": product_id, "dealer_id": dealer_id, "batch_code": "LOT-1", "expiry_date": expiry.isoformat(), "quantity": 2},
    )

    response = client.post(
        "/api/stock/outbound",
        json={"product_id": product_id, "dealer_id": dealer_id, "quantity": 3},
    )

    assert response.status_code == 409
    batches = client.get("/api/batches").json()
    assert batches[0]["quantity_on_hand"] == 2


def test_expired_batches_are_not_used_for_stock_out(client):
    product_id = create_product(client)
    dealer_id = default_dealer_id(client)
    yesterday = date.today() - timedelta(days=1)
    client.post(
        "/api/stock/inbound",
        json={"product_id": product_id, "dealer_id": dealer_id, "batch_code": "LOT-OLD", "expiry_date": yesterday.isoformat(), "quantity": 5},
    )

    response = client.post(
        "/api/stock/outbound",
        json={"product_id": product_id, "dealer_id": dealer_id, "quantity": 1},
    )

    assert response.status_code == 409
    assert response.json()["detail"].endswith("mevcut: 0.")


def test_product_update_preserves_stock_and_updates_catalog_fields(client):
    product_id = create_product(client)
    dealer_id = default_dealer_id(client)
    expiry = date.today() + timedelta(days=60)
    inbound = client.post(
        "/api/stock/inbound",
        json={"product_id": product_id, "dealer_id": dealer_id, "batch_code": "LOT-EDIT", "expiry_date": expiry.isoformat(), "quantity": 7},
    )
    assert inbound.status_code == 201

    response = client.put(
        f"/api/products/{product_id}",
        json={"sku": "SKU-UPDATED", "barcode": "1234567890123", "name": "Güncellenmiş ürün", "unit": "kutu", "category_id": None},
    )

    assert response.status_code == 200
    assert response.json()["name"] == "Güncellenmiş ürün"
    product = client.get("/api/products").json()[0]
    assert product["sku"] == "SKU-UPDATED"
    assert product["barcode"] == "1234567890123"
    assert product["total_quantity"] == 7
    batch = client.get("/api/batches").json()[0]
    assert batch["product_name"] == "Güncellenmiş ürün"
    assert batch["quantity_on_hand"] == 7


def test_product_update_rejects_duplicate_sku_and_unknown_product(client):
    product_id = create_product(client)
    other = client.post(
        "/api/products",
        json={"sku": "SKU-002", "barcode": "9876543210123", "name": "İkinci ürün", "unit": "adet"},
    )
    assert other.status_code == 201

    duplicate = client.put(
        f"/api/products/{product_id}",
        json={"sku": "SKU-002", "name": "Test Ürünü", "unit": "adet", "category_id": None},
    )
    duplicate_barcode = client.put(
        f"/api/products/{product_id}",
        json={"sku": "SKU-UPDATED", "barcode": "9876543210123", "name": "Test Ürünü", "unit": "adet", "category_id": None},
    )
    missing = client.put(
        "/api/products/99999",
        json={"sku": "SKU-999", "name": "Olmayan ürün", "unit": "adet", "category_id": None},
    )

    assert duplicate.status_code == 409
    assert duplicate_barcode.status_code == 409
    assert missing.status_code == 404
