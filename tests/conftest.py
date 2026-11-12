import os

os.environ["DATABASE_URL"] = os.getenv(
    "SAVESTOCK_TEST_DATABASE_URL", "sqlite+pysqlite:///:memory:"
)
os.environ["SAVESTOCK_ENV"] = "test"
os.environ["SAVESTOCK_COOKIE_SECURE"] = "false"
os.environ["SAVESTOCK_ALLOWED_HOSTS"] = ""

import pytest
from fastapi.testclient import TestClient

from app.database import Base, engine
from app.main import app


@pytest.fixture(autouse=True)
def clean_database():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        response = test_client.post(
            "/api/auth/setup",
            json={
                "full_name": "Test Admin",
                "email": "admin@example.test",
                "password": "test-password-123",
            },
        )
        assert response.status_code == 201
        yield test_client
