"""Slice 8 gate (unit layer): webhook signature enforcement, idempotent
approval semantics, UPI duplicate handling. The exactly-once credit grant is
proven against the LIVE database trigger by scripts/gate_slice8.py."""

import hashlib
import hmac
import json

import httpx
from fastapi.testclient import TestClient

from app.auth import get_current_user
from app.main import app
from app.supa import get_supa

SECRET = "whsec_test"


class FakeSupa:
    def __init__(self):
        self.payments: list[dict] = []
        self.updates: list[tuple[dict, dict]] = []

    async def select(self, table, params):
        return []

    async def insert(self, table, row):
        if any(p.get("provider_ref") == row.get("provider_ref") for p in self.payments):
            request = httpx.Request("POST", "http://x")
            response = httpx.Response(409, request=request)
            raise httpx.HTTPStatusError("conflict", request=request, response=response)
        self.payments.append(row)
        return {**row, "id": f"p{len(self.payments)}"}

    async def update(self, table, params, patch):
        self.updates.append((params, patch))
        # emulate PostgREST: only pending rows transition
        ref = params["provider_ref"].removeprefix("eq.")
        for p in self.payments:
            if p["provider_ref"] == ref and p["status"] == "pending":
                p["status"] = patch["status"]


def signed(body: dict) -> tuple[bytes, str]:
    raw = json.dumps(body).encode()
    return raw, hmac.new(SECRET.encode(), raw, hashlib.sha256).hexdigest()


def client_with(fake: FakeSupa) -> TestClient:
    app.dependency_overrides[get_current_user] = lambda: {"id": "user-1"}
    app.dependency_overrides[get_supa] = lambda: fake
    return TestClient(app)


def teardown_function():
    app.dependency_overrides.clear()


WEBHOOK_EVENT = {
    "event": "payment.captured",
    "payload": {"payment": {"entity": {"order_id": "order_abc123"}}},
}


def test_webhook_rejects_bad_signature(monkeypatch):
    monkeypatch.setenv("RAZORPAY_WEBHOOK_SECRET", SECRET)
    fake = FakeSupa()
    raw, _ = signed(WEBHOOK_EVENT)
    r = client_with(fake).post(
        "/billing/webhook/razorpay", content=raw,
        headers={"x-razorpay-signature": "forged"},
    )
    assert r.status_code == 400
    assert fake.updates == []


def test_webhook_approves_pending_payment(monkeypatch):
    monkeypatch.setenv("RAZORPAY_WEBHOOK_SECRET", SECRET)
    fake = FakeSupa()
    fake.payments.append({
        "provider_ref": "order_abc123", "status": "pending",
        "user_id": "user-1", "credits_granted": 2,
    })
    raw, sig = signed(WEBHOOK_EVENT)
    r = client_with(fake).post(
        "/billing/webhook/razorpay", content=raw,
        headers={"x-razorpay-signature": sig},
    )
    assert r.status_code == 200
    assert fake.payments[0]["status"] == "approved"
    # The update targets ONLY still-pending rows: replay matches nothing.
    assert fake.updates[0][0] == {"provider_ref": "eq.order_abc123", "status": "eq.pending"}


def test_webhook_replay_is_noop(monkeypatch):
    monkeypatch.setenv("RAZORPAY_WEBHOOK_SECRET", SECRET)
    fake = FakeSupa()
    fake.payments.append({
        "provider_ref": "order_abc123", "status": "approved",  # already granted
        "user_id": "user-1", "credits_granted": 2,
    })
    raw, sig = signed(WEBHOOK_EVENT)
    r = client_with(fake).post(
        "/billing/webhook/razorpay", content=raw,
        headers={"x-razorpay-signature": sig},
    )
    assert r.status_code == 200  # webhook acks; nothing transitions
    assert fake.payments[0]["status"] == "approved"


def test_webhook_unconfigured_is_503(monkeypatch):
    monkeypatch.delenv("RAZORPAY_WEBHOOK_SECRET", raising=False)
    r = client_with(FakeSupa()).post("/billing/webhook/razorpay", content=b"{}")
    assert r.status_code == 503


def test_order_endpoint_requires_razorpay_config(monkeypatch):
    monkeypatch.delenv("RAZORPAY_KEY_ID", raising=False)
    monkeypatch.delenv("RAZORPAY_KEY_SECRET", raising=False)
    r = client_with(FakeSupa()).post("/billing/order", json={"credits": 1})
    assert r.status_code == 503
    assert "UPI QR" in r.json()["detail"]


def test_upi_submission_creates_pending_and_rejects_duplicates(monkeypatch):
    monkeypatch.setenv("JD_CREDIT_PRICE_INR", "49")
    fake = FakeSupa()
    client = client_with(fake)
    r1 = client.post("/billing/upi", json={"transaction_ref": "TXN12345678", "credits": 2})
    assert r1.status_code == 200
    assert fake.payments[0]["status"] == "pending"
    assert fake.payments[0]["amount_inr"] == 98
    assert fake.payments[0]["provider"] == "upi_manual"

    r2 = client.post("/billing/upi", json={"transaction_ref": "TXN12345678", "credits": 2})
    assert r2.status_code == 409
    assert len(fake.payments) == 1
