"""Upload + parse endpoints. Parsing is deterministic (zero LLM tokens);
file-hash dedup makes re-uploading the same file free by construction."""

from __future__ import annotations

import hashlib

from fastapi import APIRouter, Depends, HTTPException, UploadFile

from app.auth import get_current_user
from app.supa import Supa, get_supa
from parsing.extract import UnsupportedFileType, extract_text
from parsing.parser import parse_resume

router = APIRouter(prefix="/resumes", tags=["resumes"])

MAX_UPLOAD_BYTES = 5 * 1024 * 1024
ALLOWED_SUFFIXES = (".pdf", ".docx")


@router.post("/upload")
async def upload_resume(
    file: UploadFile,
    user: dict = Depends(get_current_user),
    supa: Supa = Depends(get_supa),
) -> dict:
    filename = file.filename or "resume"
    if not filename.lower().endswith(ALLOWED_SUFFIXES):
        raise HTTPException(422, "Only PDF and DOCX files are supported")

    data = await file.read()
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "File is larger than 5 MB")
    if not data:
        raise HTTPException(422, "Empty file")

    user_id = user["id"]
    file_hash = hashlib.sha256(data).hexdigest()

    # Dedup: same user + same bytes -> return the existing parse, cost zero.
    existing = await supa.select(
        "resumes",
        {"user_id": f"eq.{user_id}", "file_hash": f"eq.{file_hash}", "select": "id,parsed_json,filename"},
    )
    if existing:
        return {
            "resume_id": existing[0]["id"],
            "parsed": existing[0]["parsed_json"],
            "deduped": True,
        }

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

    suffix = ".pdf" if filename.lower().endswith(".pdf") else ".docx"
    content_type = (
        "application/pdf"
        if suffix == ".pdf"
        else "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )
    await supa.upload_file("resumes", f"{user_id}/{file_hash}{suffix}", data, content_type)

    row = await supa.insert(
        "resumes",
        {
            "user_id": user_id,
            "file_hash": file_hash,
            "filename": filename,
            "parsed_json": parsed,
        },
    )
    return {"resume_id": row["id"], "parsed": parsed, "deduped": False}


@router.get("/{resume_id}")
async def get_resume(
    resume_id: str,
    user: dict = Depends(get_current_user),
    supa: Supa = Depends(get_supa),
) -> dict:
    rows = await supa.select(
        "resumes",
        {"id": f"eq.{resume_id}", "user_id": f"eq.{user['id']}",
         "select": "id,filename,parsed_json,created_at"},
    )
    if not rows:
        raise HTTPException(404, "Resume not found")
    return rows[0]


@router.get("")
async def list_resumes(
    user: dict = Depends(get_current_user),
    supa: Supa = Depends(get_supa),
) -> list[dict]:
    return await supa.select(
        "resumes",
        {
            "user_id": f"eq.{user['id']}",
            "select": "id,filename,created_at",
            "order": "created_at.desc",
        },
    )
