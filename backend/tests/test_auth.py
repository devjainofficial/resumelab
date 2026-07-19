"""Backend auth: /me must reject anonymous callers and accept valid sessions
(Supabase lookup mocked — no network in tests)."""

from fastapi.testclient import TestClient

import app.auth as auth_module
from app.main import app


def test_me_rejects_missing_token():
    client = TestClient(app)
    resp = client.get("/me")
    assert resp.status_code == 401


def test_me_rejects_empty_bearer():
    client = TestClient(app)
    resp = client.get("/me", headers={"Authorization": "Bearer "})
    assert resp.status_code == 401


def test_me_returns_user_for_valid_token(monkeypatch):
    async def fake_user(request):
        return {"id": "user-123", "email": "a@example.com"}

    app.dependency_overrides[auth_module.get_current_user] = lambda: {
        "id": "user-123",
        "email": "a@example.com",
    }
    try:
        client = TestClient(app)
        resp = client.get("/me", headers={"Authorization": "Bearer whatever"})
        assert resp.status_code == 200
        assert resp.json() == {"id": "user-123", "email": "a@example.com"}
    finally:
        app.dependency_overrides.clear()


def test_health_stays_public():
    client = TestClient(app)
    assert client.get("/health").status_code == 200
