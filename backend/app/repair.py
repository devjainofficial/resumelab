"""Score Repair endpoints: paste text or upload a screenshot, get targeted
patches and a before/after score comparison. Never a full rewrite."""

from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from pydantic import BaseModel

from app.auth import get_current_user
from app.gateway_dep import get_app_gateway
from app.supa import Supa, get_supa
from app.versions import _owned_version
from llm.gateway import BudgetExceeded, Gateway
from repair.findings import findings_from_screenshot, parse_text_findings
from repair.patcher import apply_repairs
from scoring.scorer import score_resume

router = APIRouter(prefix="/versions", tags=["repair"])


class RepairRequest(BaseModel):
    findings_text: str


async def _run_repair(
    version_id: str,
    findings: list[dict],
    note: str | None,
    user: dict,
    supa: Supa,
    gateway: Gateway,
) -> dict:
    version, resume = await _owned_version(supa, user["id"], version_id)
    if version["status"] != "final" or not version["markdown"]:
        raise HTTPException(
            409, "Run this resume through Resume Lab to a FINAL version first."
        )
    if not findings:
        return {
            "findings": [],
            "actions": [],
            "new_questions": [],
            "note": note or "No recognizable findings — paste the checker's feedback lines.",
        }

    answers = await supa.select(
        "answers", {"version_id": f"eq.{version_id}", "select": "question,answer"}
    )
    before = score_resume(version["markdown"])

    try:
        patched = apply_repairs(
            version["markdown"], findings, resume["parsed_json"], answers,
            gateway, user["id"], date.today(),
        )
    except BudgetExceeded:
        raise HTTPException(429, "Daily usage limit reached — come back tomorrow.")

    after = score_resume(patched["markdown"])
    await supa.update(
        "versions", {"id": f"eq.{version_id}"}, {"markdown": patched["markdown"]}
    )
    await supa.insert(
        "scores",
        {"version_id": version_id, "source": "external", "value": before["value"],
         "findings_json": findings},
    )
    await supa.insert(
        "scores",
        {"version_id": version_id, "source": "internal", "value": after["value"],
         "findings_json": after["checks"]},
    )
    return {
        "findings": findings,
        "actions": patched["actions"],
        "new_questions": patched["new_questions"],
        "before_score": before["value"],
        "after_score": after["value"],
        "markdown": patched["markdown"],
        "note": note,
    }


@router.post("/{version_id}/repair")
async def repair_from_text(
    version_id: str,
    req: RepairRequest,
    user: dict = Depends(get_current_user),
    supa: Supa = Depends(get_supa),
    gateway: Gateway = Depends(get_app_gateway),
) -> dict:
    findings = parse_text_findings(req.findings_text)
    return await _run_repair(version_id, findings, None, user, supa, gateway)


@router.post("/{version_id}/repair/screenshot")
async def repair_from_screenshot(
    version_id: str,
    file: UploadFile,
    user: dict = Depends(get_current_user),
    supa: Supa = Depends(get_supa),
    gateway: Gateway = Depends(get_app_gateway),
) -> dict:
    data = await file.read()
    if len(data) > 8 * 1024 * 1024:
        raise HTTPException(413, "Screenshot larger than 8 MB")
    try:
        findings, note = findings_from_screenshot(gateway, user["id"], data, date.today())
    except BudgetExceeded:
        raise HTTPException(429, "Daily usage limit reached — come back tomorrow.")
    return await _run_repair(version_id, findings, note, user, supa, gateway)
