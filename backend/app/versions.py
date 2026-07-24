"""Version endpoints: compose (markdown + status) and render (PDF/DOCX).

DRAFT renders carry a visible watermark. FINAL requires zero open inputs.
"""

from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response

from pydantic import BaseModel, Field

from app.auth import get_current_user
from app.gateway_dep import get_app_gateway
from app.supa import Supa, get_supa
from llm.gateway import BudgetExceeded, Gateway
from rewrite.composer import DRAFT_WATERMARK, compose_markdown, polish_bullets
from rewrite.renderer import render_docx, render_pdf, render_preview_html
from structures.specs import STRUCTURES

router = APIRouter(prefix="/versions", tags=["versions"])


class StructureUpdate(BaseModel):
    structure_id: str


class MarkdownUpdate(BaseModel):
    # Cap the body so a single request can't allocate hundreds of MB on the
    # free-tier VM (no LLM budget throttles this deterministic path). A real
    # one-page resume is a few KB; 100k chars is a generous ceiling.
    markdown: str = Field(max_length=100_000)
    finalize: bool = False


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


@router.get("/structures")
async def list_structures() -> list[dict]:
    return [
        {"id": sid, "name": s["name"], "audience": s["audience"],
         "template": s.get("template", "classic"),
         "section_order": s["section_order"]}
        for sid, s in STRUCTURES.items()
    ]


@router.patch("/{version_id}/structure")
async def update_structure(
    version_id: str,
    body: StructureUpdate,
    user: dict = Depends(get_current_user),
    supa: Supa = Depends(get_supa),
) -> dict:
    if body.structure_id not in STRUCTURES:
        raise HTTPException(422, f"Unknown structure: {body.structure_id}")
    await _owned_version(supa, user["id"], version_id)
    await supa.update(
        "versions", {"id": f"eq.{version_id}"},
        {"structure_id": body.structure_id},
    )
    return {"structure_id": body.structure_id}


@router.get("/by-resume/{resume_id}")
async def get_versions_for_resume(
    resume_id: str,
    user: dict = Depends(get_current_user),
    supa: Supa = Depends(get_supa),
) -> list[dict]:
    resumes = await supa.select(
        "resumes",
        {"id": f"eq.{resume_id}", "user_id": f"eq.{user['id']}", "select": "id"},
    )
    if not resumes:
        raise HTTPException(404, "Resume not found")
    versions = await supa.select(
        "versions",
        {"resume_id": f"eq.{resume_id}",
         "select": "id,structure_id,status,markdown,created_at",
         "order": "created_at.desc"},
    )
    return versions


@router.put("/{version_id}/markdown")
async def edit_markdown(
    version_id: str,
    body: MarkdownUpdate,
    user: dict = Depends(get_current_user),
    supa: Supa = Depends(get_supa),
) -> dict:
    """Save a user-edited resume. This is the escape hatch: parsing is never
    perfect, so the user can fix anything by hand and finish.

    Honesty contract still holds — finalizing is refused while placeholder
    markers ([...], TBD, XXX) remain, so a FINAL is never shipped with gaps.
    """
    import re as _re

    from parsing.parser import PLACEHOLDER_RE

    version, _ = await _owned_version(supa, user["id"], version_id)

    # Never persist the presentation-only DRAFT watermark into stored content.
    lines = [l for l in body.markdown.splitlines() if not l.startswith("> DRAFT")]
    clean = "\n".join(lines).strip()

    # Require a name heading with actual non-whitespace text after "# ".
    has_name = any(l.startswith("# ") and l[2:].strip() for l in lines)
    if len(clean) < 20 or not has_name:
        raise HTTPException(422, "Resume needs at least a name (# Name) and some content.")

    # Finalize honesty gate. PLACEHOLDER_RE only catches short [..] markers, so
    # also reject ANY remaining bracketed placeholder of any length, plus TBD/XXX.
    placeholders = [p for p in PLACEHOLDER_RE.findall(clean) if p != "(skipped)"]
    long_brackets = _re.findall(r"\[[^\]]{1,200}\]", clean)
    all_placeholders = placeholders + [b for b in long_brackets if b not in placeholders]

    if body.finalize:
        if all_placeholders:
            raise HTTPException(
                422,
                f"Fill in the placeholders before finalizing: {', '.join(all_placeholders[:5])}",
            )
        status = "final"
        stored = clean  # no watermark on a final
    else:
        status = "draft"
        stored = f"> {DRAFT_WATERMARK}\n\n{clean}"

    await supa.update(
        "versions", {"id": f"eq.{version_id}"}, {"markdown": stored, "status": status}
    )
    return {"version_id": version_id, "status": status, "markdown": stored}


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


@router.get("/{version_id}/preview")
async def preview_version(
    version_id: str,
    user: dict = Depends(get_current_user),
    supa: Supa = Depends(get_supa),
) -> Response:
    """Full HTML page for the browser iframe. Same HTML that produces the PDF,
    so the preview is pixel-identical to the download (minus the watermark
    which the download strips)."""
    version, _ = await _owned_version(supa, user["id"], version_id)
    if not version["markdown"]:
        raise HTTPException(409, "Compose this version first")
    html_doc = render_preview_html(version["markdown"], version["structure_id"])
    return Response(html_doc, media_type="text/html; charset=utf-8")


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
            render_pdf(version["markdown"], version["structure_id"]),
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
