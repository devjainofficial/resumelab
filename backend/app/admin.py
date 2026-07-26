"""Admin-only endpoints: stats dashboard, payment approval, user management.

Protected by ADMIN_EMAIL env var — only the user whose email matches gets
access. No separate admin table or role needed.
"""

from __future__ import annotations

import os
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException

from app.auth import get_current_user
from app.supa import Supa, get_supa

router = APIRouter(prefix="/admin", tags=["admin"])


def _require_admin(user: dict = Depends(get_current_user)) -> dict:
    admin_email = os.environ.get("ADMIN_EMAIL", "")
    if not admin_email or user.get("email") != admin_email:
        raise HTTPException(status_code=403, detail="Admin access only")
    return user


AdminUser = Depends(_require_admin)


@router.get("/stats")
async def admin_stats(
    _: dict = AdminUser,
    supa: Supa = Depends(get_supa),
) -> dict:
    today = date.today()
    seven_ago = (today - timedelta(days=6)).isoformat()
    today_str = today.isoformat()

    profiles = await supa.select(
        "profiles",
        {
            "select": "id,email,full_name,created_at,credits,is_free_user",
            "order": "created_at.desc",
            "limit": "100",
        },
    )
    resumes = await supa.select("resumes", {"select": "id", "limit": "10000"})
    versions = await supa.select("versions", {"select": "id,status", "limit": "10000"})
    llm_7d = await supa.select(
        "llm_usage",
        {
            "select": "task,tokens_in,tokens_out,created_at",
            "created_at": f"gte.{seven_ago}",
            "limit": "10000",
        },
    )
    pending = await supa.select(
        "payments",
        {
            "status": "eq.pending",
            "select": "id,user_id,amount_inr,credits_granted,provider,provider_ref,created_at",
            "order": "created_at.desc",
        },
    )
    scores = await supa.select(
        "scores", {"select": "value", "source": "eq.internal", "limit": "1000"}
    )

    # LLM aggregation by task
    by_task: dict[str, dict] = {}
    today_tokens = 0
    for r in llm_7d:
        t = r["task"]
        by_task.setdefault(t, {"task": t, "calls": 0, "tokens_in": 0, "tokens_out": 0})
        by_task[t]["calls"] += 1
        by_task[t]["tokens_in"] += r.get("tokens_in") or 0
        by_task[t]["tokens_out"] += r.get("tokens_out") or 0
        if (r.get("created_at") or "").startswith(today_str):
            today_tokens += (r.get("tokens_in") or 0) + (r.get("tokens_out") or 0)

    # LLM aggregation by day (last 7)
    by_day: dict[str, dict] = {}
    for i in range(7):
        d = (today - timedelta(days=i)).isoformat()
        by_day[d] = {"day": d, "calls": 0, "tokens": 0}
    for r in llm_7d:
        d = (r.get("created_at") or "")[:10]
        if d in by_day:
            by_day[d]["calls"] += 1
            by_day[d]["tokens"] += (r.get("tokens_in") or 0) + (r.get("tokens_out") or 0)

    tokens_7d = sum((r.get("tokens_in") or 0) + (r.get("tokens_out") or 0) for r in llm_7d)
    avg_score = round(sum(s["value"] for s in scores) / len(scores), 1) if scores else 0

    return {
        "overview": {
            "total_users": len(profiles),
            "total_resumes": len(resumes),
            "total_versions": len(versions),
            "final_versions": sum(1 for v in versions if v.get("status") == "final"),
            "llm_tokens_today": today_tokens,
            "llm_tokens_7d": tokens_7d,
            "pending_payments": len(pending),
            "avg_ats_score": avg_score,
        },
        "llm_by_task": sorted(by_task.values(), key=lambda x: -x["calls"]),
        "llm_by_day": sorted(by_day.values(), key=lambda x: x["day"]),
        "recent_users": profiles[:25],
        "pending_payments": pending,
    }


@router.post("/payments/{payment_id}/approve")
async def approve_payment(
    payment_id: str,
    _: dict = AdminUser,
    supa: Supa = Depends(get_supa),
) -> dict:
    rows = await supa.select(
        "payments",
        {"id": f"eq.{payment_id}", "status": "eq.pending", "select": "id"},
    )
    if not rows:
        raise HTTPException(404, "Payment not found or already processed")
    await supa.update(
        "payments",
        {"id": f"eq.{payment_id}", "status": "eq.pending"},
        {"status": "approved"},
    )
    return {"ok": True}


@router.post("/users/{user_id}/toggle-free")
async def toggle_free_user(
    user_id: str,
    _: dict = AdminUser,
    supa: Supa = Depends(get_supa),
) -> dict:
    rows = await supa.select(
        "profiles", {"id": f"eq.{user_id}", "select": "is_free_user"}
    )
    if not rows:
        raise HTTPException(404, "User not found")
    new_val = not rows[0]["is_free_user"]
    await supa.update("profiles", {"id": f"eq.{user_id}"}, {"is_free_user": new_val})
    return {"is_free_user": new_val}
