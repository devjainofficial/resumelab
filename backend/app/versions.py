"""Version endpoints: compose (markdown + status) and render (PDF/DOCX).

DRAFT renders carry a visible watermark. FINAL requires zero open inputs.
"""

from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response

from app.auth import get_current_user
from app.gateway_dep import get_app_gateway
from app.supa import Supa, get_supa
from llm.gateway import BudgetExceeded, Gateway
from rewrite.composer import compose_markdown, polish_bullets
from rewrite.renderer import render_docx, render_pdf

router = APIRouter(prefix="/versions", tags=["versions"])


async def _owned_version(supa: Supa, user_id: str, version_id: str) -> tuple[dict, dict]:
    versions = await supa.select(
        "versions",
        {"id": f"eq.{version_id}", "select": "id,resume_id,structure_id,markdown,status"},
    )
    if not versions:
        raise HTTPException(404, "Version not found")
    version = versions[0]
    resumes = await supa.select(
        "resumes",
        {"id": f"eq.{version['resume_id']}", "user_id": f"eq.{user_id}", "select": "id,parsed_json"},
    )
    if not resumes:
        raise HTTPException(404, "Version not found")
    return version, resumes[0]


@router.post("/{version_id}/compose")
async def compose_version(
    version_id: str,
    user: dict = Depends(get_current_user),
    supa: Supa = Depends(get_supa),
    gateway: Gateway = Depends(get_app_gateway),
) -> dict:
    version, resume = await _owned_version(supa, user["id"], version_id)
    answers = await supa.select(
        "answers", {"version_id": f"eq.{version_id}", "select": "question,answer"}
    )

    markdown, status, open_questions = compose_markdown(
        resume["parsed_json"], answers, version["structure_id"]
    )
    try:
        markdown = polish_bullets(
            gateway, user["id"], markdown, resume["parsed_json"], answers, date.today()
        )
    except BudgetExceeded:
        pass  # deterministic markdown already stands; polish is optional

    await supa.update(
        "versions", {"id": f"eq.{version_id}"}, {"markdown": markdown, "status": status}
    )
    return {
        "version_id": version_id,
        "status": status,
        "markdown": markdown,
        "open_questions": open_questions,
    }


@router.get("/{version_id}/download/{fmt}")
async def download_version(
    version_id: str,
    fmt: str,
    user: dict = Depends(get_current_user),
    supa: Supa = Depends(get_supa),
) -> Response:
    version, _ = await _owned_version(supa, user["id"], version_id)
    if not version["markdown"]:
        raise HTTPException(409, "Compose this version first")

    if fmt == "pdf":
        return Response(
            render_pdf(version["markdown"]),
            media_type="application/pdf",
            headers={"Content-Disposition": 'attachment; filename="resume.pdf"'},
        )
    if fmt == "docx":
        return Response(
            render_docx(version["markdown"]),
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={"Content-Disposition": 'attachment; filename="resume.docx"'},
        )
    raise HTTPException(422, "Format must be pdf or docx")
