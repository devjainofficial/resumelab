"""JD enhancer endpoint: the one metered feature."""

from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.auth import get_current_user
from app.gateway_dep import get_app_gateway
from app.supa import Supa, get_supa
from app.versions import _owned_version
from billing.access import check_jd_access
from enhancer.enhance import enhance
from llm.gateway import BudgetExceeded, Gateway
from parsing.parser import PLACEHOLDER_RE

router = APIRouter(prefix="/versions", tags=["enhance"])

REFUSAL = "Run this resume through Resume Lab first, then tailor it."


class EnhanceRequest(BaseModel):
    jd_text: str


@router.post("/{version_id}/enhance")
async def enhance_version(
    version_id: str,
    req: EnhanceRequest,
    user: dict = Depends(get_current_user),
    supa: Supa = Depends(get_supa),
    gateway: Gateway = Depends(get_app_gateway),
) -> dict:
    if len(req.jd_text.strip()) < 30:
        raise HTTPException(422, "Paste the full job description (at least a few lines).")

    version, resume = await _owned_version(supa, user["id"], version_id)
    # Contract: only FINAL, placeholder-free resumes may be tailored.
    if version["status"] != "final" or not version["markdown"]:
        raise HTTPException(409, REFUSAL)
    if any(p for p in PLACEHOLDER_RE.findall(version["markdown"]) if p != "(skipped)"):
        raise HTTPException(409, REFUSAL)

    # Access chain: free flag -> allowance -> credits -> paywall.
    access = await check_jd_access(supa, user["id"])
    if not access.allowed:
        raise HTTPException(402, access.paywall)

    answers = await supa.select(
        "answers", {"version_id": f"eq.{version_id}", "select": "question,answer"}
    )
    try:
        result = enhance(
            version["markdown"], req.jd_text, resume["parsed_json"], answers,
            gateway, user["id"], date.today(),
        )
    except BudgetExceeded:
        raise HTTPException(429, "Daily usage limit reached — come back tomorrow.")

    variant = await supa.insert(
        "versions",
        {
            "resume_id": version["resume_id"],
            "structure_id": version["structure_id"],
            "markdown": result["markdown"],
            "status": "final",
        },
    )
    return {
        "variant_version_id": variant["id"],
        "lane": access.lane,
        "actions": result["actions"],
        "coverage": result["coverage"],
        "markdown": result["markdown"],
    }
