"""Wizard endpoints: start (draft version + questions) and answers.

Every answer is stored as a user-stated fact in `answers`, reused later.
The wizard runs BEFORE any rewrite; no rewrite starts with open critical gaps.
"""

from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.auth import get_current_user
from app.gateway_dep import get_app_gateway
from app.supa import Supa, get_supa
from llm.gateway import BudgetExceeded, Gateway
from structures.specs import recommend_structure
from wizard.gaps import _estimate_years, detect_gaps, refine_questions

router = APIRouter(prefix="/wizard", tags=["wizard"])


class StartRequest(BaseModel):
    resume_id: str


class AnswerItem(BaseModel):
    id: str | None = None  # question id from /wizard/start
    question: str
    answer: str


class AnswersRequest(BaseModel):
    version_id: str
    answers: list[AnswerItem]


class SuggestRequest(BaseModel):
    resume_id: str
    question: str
    question_id: str | None = None


async def _owned_resume(supa: Supa, user_id: str, resume_id: str) -> dict:
    rows = await supa.select(
        "resumes",
        {"id": f"eq.{resume_id}", "user_id": f"eq.{user_id}", "select": "id,parsed_json"},
    )
    if not rows:
        raise HTTPException(404, "Resume not found")
    return rows[0]


@router.post("/start")
async def start_wizard(
    req: StartRequest,
    user: dict = Depends(get_current_user),
    supa: Supa = Depends(get_supa),
    gateway: Gateway = Depends(get_app_gateway),
) -> dict:
    resume = await _owned_resume(supa, user["id"], req.resume_id)
    parsed = resume["parsed_json"]

    questions = detect_gaps(parsed)
    try:
        questions = refine_questions(gateway, user["id"], parsed, questions, date.today())
    except BudgetExceeded as e:
        # Budget never blocks the wizard: the deterministic set costs nothing.
        _ = e

    years = _estimate_years(parsed)
    structure_id = recommend_structure(None, bool(parsed["sections"]["projects"]), years)

    version = await supa.insert(
        "versions",
        {"resume_id": req.resume_id, "structure_id": structure_id, "markdown": "", "status": "draft"},
    )
    return {
        "version_id": version["id"],
        "structure_id": structure_id,
        "questions": questions,
    }


@router.post("/suggest")
async def suggest_answer(
    req: SuggestRequest,
    user: dict = Depends(get_current_user),
    supa: Supa = Depends(get_supa),
    gateway: Gateway = Depends(get_app_gateway),
) -> dict:
    """AI-suggest a plausible answer, grounded in the user's parsed resume.

    The model is told never to invent numbers or facts — if there's no
    signal in the resume, it should return an empty suggestion so the user
    supplies the real value. Uses the cheapest tier (flash-lite).
    """
    resume = await _owned_resume(supa, user["id"], req.resume_id)
    import json as _json

    payload = _json.dumps({
        "question": req.question,
        "question_id": req.question_id,
        "parsed": resume["parsed_json"],
    }, sort_keys=True)

    try:
        raw = gateway.call(
            user_id=user["id"], task="wizard_suggest",
            content=payload, today=date.today(),
        )
    except BudgetExceeded:
        return {"suggestion": "", "reason": "Daily budget exhausted"}

    # Real gateway returns JSON: {"suggestion": "...", "confidence": "high|med|low"}
    # Mock gateway returns non-JSON marker: no suggestion available.
    try:
        parsed = _json.loads(raw)
        suggestion = (parsed.get("suggestion") or "").strip()
        confidence = parsed.get("confidence") or "low"
    except (_json.JSONDecodeError, AttributeError):
        return {"suggestion": "", "reason": "No suggestion available"}

    return {"suggestion": suggestion, "confidence": confidence}


@router.post("/answers")
async def save_answers(
    req: AnswersRequest,
    user: dict = Depends(get_current_user),
    supa: Supa = Depends(get_supa),
) -> dict:
    # Ownership: version -> resume -> user.
    versions = await supa.select(
        "versions", {"id": f"eq.{req.version_id}", "select": "id,resume_id"}
    )
    if not versions:
        raise HTTPException(404, "Version not found")
    await _owned_resume(supa, user["id"], versions[0]["resume_id"])

    stored = 0
    for item in req.answers:
        # A blank answer means "this fact does not exist" — store it as an
        # explicit skip so the gap closes WITHOUT inventing anything.
        answer = item.answer.strip() or "(skipped)"
        question_field = f"{item.id} :: {item.question}" if item.id else item.question
        await supa.insert(
            "answers",
            {"version_id": req.version_id, "question": question_field, "answer": answer},
        )
        stored += 1
    return {"stored": stored}
