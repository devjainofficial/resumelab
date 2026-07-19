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
    question: str
    answer: str


class AnswersRequest(BaseModel):
    version_id: str
    answers: list[AnswerItem]


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
        if not item.answer.strip():
            continue  # an empty answer is not a fact; never store blanks
        await supa.insert(
            "answers",
            {"version_id": req.version_id, "question": item.question, "answer": item.answer.strip()},
        )
        stored += 1
    return {"stored": stored}
