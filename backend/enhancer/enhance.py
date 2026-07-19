"""JD enhancer: FINAL resume + JD -> tailored variant + coverage report.

Truthful moves only:
- skills reorder: JD-relevant skills first (same tokens, new order)
- synonym canonicalization: a term the resume already proves gets the JD's
  spelling (postgres -> PostgreSQL). The mapping is a fixed table; nothing
  the resume doesn't contain can ever appear.
- summary tailoring: flash pass, truth-checked like every other rewrite
Experience content is NEVER touched. No new facts, no new skills.
"""

from __future__ import annotations

import json
import re
from datetime import date

from llm.gateway import Gateway
from rewrite.composer import _is_truthful
from rewrite.facts import source_corpus
from scoring.keywords import coverage, extract_keywords

# Both spellings of each tech are the same truth; keys are lowercase resume
# forms, values are the canonical form a JD most often uses.
SYNONYMS: dict[str, str] = {
    "postgres": "PostgreSQL",
    "js": "JavaScript",
    "ts": "TypeScript",
    "k8s": "Kubernetes",
    "gcp": "Google Cloud",
    "ml": "machine learning",
    "ci/cd": "CI/CD",
}


def _skills_line_index(lines: list[str]) -> int | None:
    for i, line in enumerate(lines):
        if line.strip().lower() == "## skills" and i + 1 < len(lines):
            return i + 1
    return None


def enhance(
    markdown: str,
    jd_text: str,
    parsed: dict,
    answers: list[dict],
    gateway: Gateway,
    user_id: str,
    today: date,
) -> dict:
    lines = markdown.splitlines()
    keywords = extract_keywords(jd_text)
    actions: list[str] = []

    # ---- skills reorder: JD-matched skills first, everything kept
    idx = _skills_line_index(lines)
    if idx is not None:
        skills = [s.strip() for s in lines[idx].split(",") if s.strip()]
        jd_set = set(keywords)
        matched = [s for s in skills if any(k in s.lower() for k in jd_set)]
        rest = [s for s in skills if s not in matched]
        reordered = matched + rest
        if reordered != skills:
            lines[idx] = ", ".join(reordered)
            actions.append(
                f"Reordered skills to lead with JD matches: {', '.join(matched[:5])}"
            )

    # ---- synonym canonicalization: only terms the resume already contains
    corpus_lower = markdown.lower()
    for resume_form, canonical in SYNONYMS.items():
        if resume_form in corpus_lower and canonical.lower() in jd_text.lower():
            pattern = re.compile(rf"\b{re.escape(resume_form)}\b", re.IGNORECASE)
            skills_zone = _skills_line_index(lines)
            if skills_zone is not None and pattern.search(lines[skills_zone]):
                lines[skills_zone] = pattern.sub(canonical, lines[skills_zone])
                actions.append(f'Matched JD spelling: "{resume_form}" -> "{canonical}"')

    # ---- summary tailoring via flash, truth-checked
    summary_idx = None
    for i, line in enumerate(lines):
        if line.strip().lower() == "## summary" and i + 1 < len(lines):
            summary_idx = i + 1
            break
    if summary_idx is not None:
        result = gateway.call(
            user_id=user_id,
            task="jd_enhance",
            content=json.dumps(
                {"summary": lines[summary_idx], "jd_keywords": keywords[:12]},
                sort_keys=True,
            ),
            today=today,
        )
        try:
            payload = json.loads(result)
            candidate = payload.get("summary") if isinstance(payload, dict) else None
        except json.JSONDecodeError:
            candidate = None
        if candidate and isinstance(candidate, str):
            corpus = source_corpus(parsed, answers) + " " + lines[summary_idx]
            if _is_truthful(candidate, corpus) and len(candidate) < 500:
                lines[summary_idx] = candidate
                actions.append("Tailored the summary toward the JD (facts unchanged)")

    out_markdown = "\n".join(lines) + ("\n" if markdown.endswith("\n") else "")
    ratio, present, missing = coverage(out_markdown, keywords)
    return {
        "markdown": out_markdown,
        "actions": actions,
        "coverage": {
            "ratio": round(ratio, 3),
            "present": present,
            "missing": missing,
            "note": (
                "Missing keywords are skills the resume doesn't prove. "
                "ResumeLab never adds unproven skills — gain them, then add them."
            ),
        },
    }
