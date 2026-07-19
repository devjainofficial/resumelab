"""Score endpoint: deterministic ATS score for FINAL versions only."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.auth import get_current_user
from app.supa import Supa, get_supa
from app.versions import _owned_version
from scoring.scorer import score_resume

router = APIRouter(prefix="/versions", tags=["scores"])


class ScoreRequest(BaseModel):
    jd_text: str | None = None


@router.post("/{version_id}/score")
async def score_version(
    version_id: str,
    req: ScoreRequest,
    user: dict = Depends(get_current_user),
    supa: Supa = Depends(get_supa),
) -> dict:
    version, _ = await _owned_version(supa, user["id"], version_id)
    if version["status"] != "final":
        raise HTTPException(
            409, "Drafts can't be scored. Answer the remaining wizard questions first."
        )
    if not version["markdown"]:
        raise HTTPException(409, "Compose this version first")

    result = score_resume(version["markdown"], req.jd_text)
    await supa.insert(
        "scores",
        {
            "version_id": version_id,
            "source": "internal",
            "value": result["value"],
            "findings_json": result["checks"],
        },
    )
    return result
