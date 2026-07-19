"""Gap detector: parsed resume -> wizard question set.

Deterministic checks find the gaps and score their impact; one flash-lite
gateway pass (mock in dev) may refine phrasing but can never add facts.
Hard cap 10 questions. A missing number becomes a question, never a guess.
"""

from __future__ import annotations

import json
import re
from datetime import date
from typing import Any

from llm.gateway import Gateway

HARD_CAP = 10
NUMBER_RE = re.compile(r"\d")
YEAR_RE = re.compile(r"\b(19|20)\d{2}\b")


def _has_number(text: str) -> bool:
    return bool(NUMBER_RE.search(text))


def _estimate_years(parsed: dict) -> int | None:
    """Career span from the earliest year in experience to now; None if no
    dated experience."""
    years = [
        int(m.group(0))
        for entry in parsed["sections"]["experience"]
        for line in entry["header"]
        for m in YEAR_RE.finditer(line)
    ]
    if not years:
        return None
    return max(0, date.today().year - min(years))


def detect_gaps(parsed: dict) -> list[dict[str, Any]]:
    """Return question dicts: {id, kind, question, options?, unit?,
    score_impact}. Sorted by score_impact desc, capped at HARD_CAP."""
    questions: list[dict[str, Any]] = []
    contact = parsed["contact"]
    sections = parsed["sections"]

    # --- contact completeness (direct scorer checks -> high impact)
    if not contact.get("email"):
        questions.append({
            "id": "contact_email", "kind": "text",
            "question": "What email address should appear on the resume?",
            "score_impact": 10,
        })
    if not contact.get("phone"):
        questions.append({
            "id": "contact_phone", "kind": "text",
            "question": "What phone number should appear on the resume?",
            "score_impact": 8,
        })
    if not contact.get("linkedin"):
        questions.append({
            "id": "contact_linkedin", "kind": "text",
            "question": "What is your LinkedIn profile URL? (ATS checks look for it)",
            "score_impact": 7,
        })

    # --- target role level: inferable -> multiple choice
    years = _estimate_years(parsed)
    inferred = None
    if years is not None:
        inferred = "senior" if years >= 6 else "mid" if years >= 3 else "fresher"
    questions.append({
        "id": "target_level", "kind": "mc",
        "question": "What role level are you targeting?",
        "options": ["Fresher / entry level", "Mid-level", "Senior", "Lead / management"],
        "inferred": inferred,
        "score_impact": 9,
    })

    # --- section emphasis when both projects and experience exist
    if sections["projects"] and sections["experience"]:
        questions.append({
            "id": "emphasis", "kind": "mc",
            "question": "What should the resume lead with?",
            "options": ["Work experience", "Projects", "Balanced"],
            "score_impact": 5,
        })
    if len(sections["projects"]) > 2:
        names = [e["header"][0] for e in sections["projects"] if e["header"]][:6]
        questions.append({
            "id": "top_projects", "kind": "mc",
            "question": "Which project matters most for your target roles?",
            "options": names,
            "score_impact": 5,
        })

    # --- summary
    if not sections["summary"] or len(sections["summary"].split()) < 8:
        questions.append({
            "id": "target_role", "kind": "text",
            "question": "In one line: what role/stack are you targeting? (Used to write your summary — nothing is invented.)",
            "score_impact": 8,
        })

    # --- skills thin
    if len(sections["skills"]) < 5:
        questions.append({
            "id": "skills_list", "kind": "text",
            "question": "List your main technical skills, comma-separated (most job-relevant first).",
            "score_impact": 7,
        })

    # --- quantification: unnumbered bullets -> numeric questions, newest first
    unquantified: list[tuple[str, str]] = []
    for section in ("experience", "projects"):
        for i, entry in enumerate(sections[section]):
            for j, bullet in enumerate(entry["bullets"]):
                if not _has_number(bullet):
                    unquantified.append((f"quant_{section}_{i}_{j}", bullet))
    for qid, bullet in unquantified[:4]:  # cap: leave room for other gaps
        questions.append({
            "id": qid, "kind": "number",
            "question": (
                f'For "{bullet}" — give one real number that captures the impact '
                "(people, users, %, amount, or time). Leave blank if none exists."
            ),
            "unit": "free",
            "score_impact": 6,
        })

    # --- education dates (undated entries hurt ATS)
    for i, entry in enumerate(sections["education"]):
        if not entry.get("dates"):
            questions.append({
                "id": f"edu_dates_{i}", "kind": "text",
                "question": f'What years did "{entry["header"][0] if entry["header"] else "your education"}" span?',
                "score_impact": 4,
            })

    questions.sort(key=lambda q: q["score_impact"], reverse=True)
    return questions[:HARD_CAP]


def refine_questions(
    gateway: Gateway, user_id: str, parsed: dict, questions: list[dict], today: date
) -> list[dict]:
    """One flash-lite pass that may reorder/reword (never add facts or exceed
    the cap). The mock gateway returns a non-JSON marker, in which case the
    deterministic set stands — dev and CI stay deterministic."""
    payload = json.dumps({"questions": questions, "stats": parsed["stats"]}, sort_keys=True)
    result = gateway.call(user_id=user_id, task="gap_detect", content=payload, today=today)
    try:
        refined = json.loads(result)
        assert isinstance(refined, list)
    except (json.JSONDecodeError, AssertionError):
        return questions
    # Whatever the model returns, only known question ids survive and the cap
    # still applies: the LLM cannot invent questions about facts we never saw.
    by_id = {q["id"]: q for q in questions}
    kept = [by_id[q["id"]] for q in refined if isinstance(q, dict) and q.get("id") in by_id]
    return (kept or questions)[:HARD_CAP]
