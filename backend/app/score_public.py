"""Public (no-auth) quick-score endpoint.

Parse and score any resume without an account — nothing is persisted.
Used by the /score landing page so users can try before signing up.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, UploadFile

from parsing.extract import UnsupportedFileType, extract_text
from parsing.parser import parse_resume
from rewrite.composer import DRAFT_WATERMARK, compose_markdown
from scoring.scorer import score_resume

router = APIRouter(tags=["score"])

MAX_UPLOAD_BYTES = 5 * 1024 * 1024
ALLOWED_SUFFIXES = (".pdf", ".docx")


@router.post("/score")
async def public_score(file: UploadFile) -> dict:
    """Parse and score any resume. No account needed, nothing stored."""
    filename = file.filename or "resume"
    if not filename.lower().endswith(ALLOWED_SUFFIXES):
        raise HTTPException(422, "Only PDF and DOCX files are supported")

    data = await file.read()
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "File is larger than 5 MB")
    if not data:
        raise HTTPException(422, "Empty file")

    try:
        text = extract_text(filename, data)
    except UnsupportedFileType:
        raise HTTPException(422, "Only PDF and DOCX files are supported")
    except Exception:
        raise HTTPException(422, "Could not read this file. Is it a valid PDF/DOCX?")

    if len(text.strip()) < 50:
        raise HTTPException(
            422,
            "No readable text found. If this is a scanned/image PDF, export a text-based one.",
        )

    parsed = parse_resume(text)
    markdown, _, _ = compose_markdown(parsed, [], "S1")
    clean_md = (
        "\n".join(
            line
            for line in markdown.splitlines()
            if not line.startswith(f"> {DRAFT_WATERMARK}")
        ).strip()
        + "\n"
    )

    result = score_resume(clean_md)
    return {
        "score": result["value"],
        "checks": result["checks"],
        "criteria": result["criteria"],
        "filename": filename,
    }
