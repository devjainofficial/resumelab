"""Billing: Razorpay checkout + webhook (preferred) and UPI manual fallback.

Credits are a ledger — balances only ever change through:
- the payments trigger (pending -> approved grants credits_granted once)
- the use_jd_credit RPC (spend, atomic with its usage row)
A duplicate webhook can never double-grant: the approval UPDATE only matches
rows still in 'pending', and the DB trigger only fires on that transition.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import os

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from app.auth import get_current_user
from app.supa import Supa, get_supa

router = APIRouter(prefix="/billing", tags=["billing"])


def _price_inr() -> int:
    return int(os.environ.get("JD_CREDIT_PRICE_INR", "49"))


@router.get("/status")
async def billing_status(
    user: dict = Depends(get_current_user),
    supa: Supa = Depends(get_supa),
) -> dict:
    profiles = await supa.select(
        "profiles", {"id": f"eq.{user['id']}", "select": "is_free_user,credits"}
    )
    profile = profiles[0] if profiles else {"is_free_user": False, "credits": 0}
    runs = await supa.select(
        "llm_usage",
        {"user_id": f"eq.{user['id']}", "task": "eq.jd_enhance_run", "select": "id"},
    )
    free_total = int(os.environ.get("FREE_JD_RUNS", "2"))
    return {
        "credits": profile["credits"],
        "is_free_user": profile["is_free_user"],
        "free_runs_total": free_total,
        "free_runs_used": min(len(runs), free_total),
        "price_inr": _price_inr(),
        "razorpay_available": bool(os.environ.get("RAZORPAY_KEY_ID")),
        "razorpay_key_id": os.environ.get("RAZORPAY_KEY_ID") or None,
        "upi_qr_url": os.environ.get("UPI_QR_IMAGE_URL") or None,
    }


# ------------------------------------------------------------ Razorpay v2


class OrderRequest(BaseModel):
    credits: int = Field(default=1, ge=1, le=50)


@router.post("/order")
async def create_order(
    req: OrderRequest,
    user: dict = Depends(get_current_user),
    supa: Supa = Depends(get_supa),
) -> dict:
    key_id = os.environ.get("RAZORPAY_KEY_ID")
    key_secret = os.environ.get("RAZORPAY_KEY_SECRET")
    if not key_id or not key_secret:
        raise HTTPException(503, "Card/UPI checkout isn't configured yet — use the UPI QR option.")

    amount_paise = req.credits * _price_inr() * 100
    async with httpx.AsyncClient(timeout=20, auth=(key_id, key_secret)) as c:
        r = await c.post(
            "https://api.razorpay.com/v1/orders",
            json={"amount": amount_paise, "currency": "INR",
                  "notes": {"user_id": user["id"], "credits": str(req.credits)}},
        )
    if r.status_code != 200:
        raise HTTPException(502, "Payment provider is unavailable — try again shortly.")
    order = r.json()

    await supa.insert(
        "payments",
        {
            "user_id": user["id"],
            "provider": "razorpay",
            "amount_inr": req.credits * _price_inr(),
            "credits_granted": req.credits,
            "status": "pending",
            "provider_ref": order["id"],
        },
    )
    return {"order_id": order["id"], "amount": amount_paise, "currency": "INR",
            "key_id": key_id}


@router.post("/webhook/razorpay")
async def razorpay_webhook(request: Request, supa: Supa = Depends(get_supa)) -> dict:
    secret = os.environ.get("RAZORPAY_WEBHOOK_SECRET")
    if not secret:
        raise HTTPException(503, "webhook not configured")

    body = await request.body()
    signature = request.headers.get("x-razorpay-signature", "")
    expected = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(signature, expected):
        raise HTTPException(400, "bad signature")

    event = json.loads(body)
    if event.get("event") not in ("order.paid", "payment.captured"):
        return {"ok": True, "ignored": event.get("event")}

    order_id = (
        event.get("payload", {}).get("payment", {}).get("entity", {}).get("order_id")
        or event.get("payload", {}).get("order", {}).get("entity", {}).get("id")
    )
    if not order_id:
        return {"ok": True, "ignored": "no order id"}

    # Idempotent by construction: only a still-pending row can transition, and
    # the DB trigger grants exactly on that transition. A replayed webhook
    # matches zero rows and grants nothing.
    await supa.update(
        "payments",
        {"provider_ref": f"eq.{order_id}", "status": "eq.pending"},
        {"status": "approved"},
    )
    return {"ok": True}


# ------------------------------------------------------------- UPI manual


class UpiSubmission(BaseModel):
    transaction_ref: str = Field(min_length=6, max_length=64)
    credits: int = Field(default=1, ge=1, le=50)


@router.post("/upi")
async def submit_upi_reference(
    req: UpiSubmission,
    user: dict = Depends(get_current_user),
    supa: Supa = Depends(get_supa),
) -> dict:
    try:
        await supa.insert(
            "payments",
            {
                "user_id": user["id"],
                "provider": "upi_manual",
                "amount_inr": req.credits * _price_inr(),
                "credits_granted": req.credits,
                "status": "pending",
                "provider_ref": f"upi:{req.transaction_ref.strip()}",
            },
        )
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 409:
            raise HTTPException(409, "This transaction reference was already submitted.")
        raise
    return {
        "ok": True,
        "message": "Reference received. Credits are granted after a quick manual check (usually same day).",
    }
