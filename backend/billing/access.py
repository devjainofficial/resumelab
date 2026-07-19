"""JD enhancer access check — the ONLY metered feature. Order is fixed:

1. profiles.is_free_user  -> run free, still log usage
2. FREE_JD_RUNS allowance -> run and count it
3. credits > 0            -> atomic decrement via use_jd_credit RPC
4. otherwise              -> paywall payload, never an error

Every allowed run writes an llm_usage row (task=jd_enhance_run) whose model
field names the lane: free_flag | allowance | credit. That row IS the ledger
entry explaining the run.
"""

from __future__ import annotations

import os
from dataclasses import dataclass

from app.supa import Supa


@dataclass
class AccessResult:
    allowed: bool
    lane: str  # free_flag | allowance | credit | paywall
    paywall: dict | None = None


def _free_runs() -> int:
    return int(os.environ.get("FREE_JD_RUNS", "2"))


def _price_inr() -> int:
    return int(os.environ.get("JD_CREDIT_PRICE_INR", "49"))


async def check_jd_access(supa: Supa, user_id: str) -> AccessResult:
    profiles = await supa.select(
        "profiles", {"id": f"eq.{user_id}", "select": "is_free_user,credits"}
    )
    if not profiles:
        return AccessResult(False, "paywall", _paywall(0))
    profile = profiles[0]

    if profile["is_free_user"]:
        await supa.insert(
            "llm_usage",
            {"user_id": user_id, "task": "jd_enhance_run", "model": "free_flag",
             "tokens_in": 0, "tokens_out": 0},
        )
        return AccessResult(True, "free_flag")

    used = await supa.select(
        "llm_usage",
        {"user_id": f"eq.{user_id}", "task": "eq.jd_enhance_run", "select": "id"},
    )
    if len(used) < _free_runs():
        await supa.insert(
            "llm_usage",
            {"user_id": user_id, "task": "jd_enhance_run", "model": "allowance",
             "tokens_in": 0, "tokens_out": 0},
        )
        return AccessResult(True, "allowance")

    if await supa.rpc("use_jd_credit", {"p_user": user_id}):
        return AccessResult(True, "credit")

    return AccessResult(False, "paywall", _paywall(profile["credits"]))


def _paywall(credits: int) -> dict:
    return {
        "paywall": True,
        "credits": credits,
        "price_inr": _price_inr(),
        "message": (
            "You've used your free JD tailoring runs. Add credits to keep "
            "tailoring — your resumes and scores stay free forever."
        ),
    }
