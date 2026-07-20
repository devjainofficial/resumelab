"""Outcomes: where each version was sent and what happened. This data
compounds across versions — the long-term moat."""

from __future__ import annotations

from datetime import date as date_type

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.auth import get_current_user
from app.supa import Supa, get_supa
from app.versions import _owned_version

router = APIRouter(tags=["outcomes"])


class OutcomeCreate(BaseModel):
    version_id: str
    sent_to: str = Field(min_length=1, max_length=200)
    sent_date: date_type
    result: str = Field(default="pending", pattern="^(call|no_call|pending)$")


class OutcomeUpdate(BaseModel):
    result: str = Field(pattern="^(call|no_call|pending)$")


@router.post("/outcomes")
async def log_outcome(
    req: OutcomeCreate,
    user: dict = Depends(get_current_user),
    supa: Supa = Depends(get_supa),
) -> dict:
    await _owned_version(supa, user["id"], req.version_id)  # 404 if not owned
    row = await supa.insert(
        "outcomes",
        {
            "version_id": req.version_id,
            "sent_to": req.sent_to.strip(),
            "sent_date": req.sent_date.isoformat(),
            "result": req.result,
        },
    )
    return row


@router.patch("/outcomes/{outcome_id}")
async def update_outcome(
    outcome_id: str,
    req: OutcomeUpdate,
    user: dict = Depends(get_current_user),
    supa: Supa = Depends(get_supa),
) -> dict:
    rows = await supa.select(
        "outcomes", {"id": f"eq.{outcome_id}", "select": "id,version_id"}
    )
    if not rows:
        raise HTTPException(404, "Outcome not found")
    await _owned_version(supa, user["id"], rows[0]["version_id"])
    await supa.update("outcomes", {"id": f"eq.{outcome_id}"}, {"result": req.result})
    return {"ok": True}


@router.get("/outcomes")
async def list_outcomes(
    user: dict = Depends(get_current_user),
    supa: Supa = Depends(get_supa),
) -> list[dict]:
    """All outcomes for the user's versions, with version context and the
    latest internal score per version."""
    resumes = await supa.select(
        "resumes", {"user_id": f"eq.{user['id']}", "select": "id,filename"}
    )
    if not resumes:
        return []
    resume_ids = ",".join(r["id"] for r in resumes)
    versions = await supa.select(
        "versions",
        {"resume_id": f"in.({resume_ids})", "select": "id,resume_id,structure_id,status,created_at"},
    )
    if not versions:
        return []
    version_ids = ",".join(v["id"] for v in versions)
    outcomes = await supa.select(
        "outcomes",
        {"version_id": f"in.({version_ids})",
         "select": "id,version_id,sent_to,sent_date,result", "order": "sent_date.desc"},
    )
    scores = await supa.select(
        "scores",
        {"version_id": f"in.({version_ids})", "source": "eq.internal",
         "select": "version_id,value,created_at", "order": "created_at.desc"},
    )
    filename_by_resume = {r["id"]: r["filename"] for r in resumes}
    version_by_id = {v["id"]: v for v in versions}
    latest_score: dict[str, int] = {}
    for s in scores:
        latest_score.setdefault(s["version_id"], s["value"])

    out = []
    for o in outcomes:
        v = version_by_id.get(o["version_id"], {})
        out.append({
            **o,
            "structure_id": v.get("structure_id"),
            "resume_filename": filename_by_resume.get(v.get("resume_id"), "?"),
            "score": latest_score.get(o["version_id"]),
        })
    return out
