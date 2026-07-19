"""Fact store: the ONLY inputs the composer may use.

Facts come from exactly two places — the parsed upload and the user's wizard
answers — each carrying provenance. Merging answers into the parsed structure
is deterministic; a missing value stays missing (it can only become a wizard
question, never a guess).
"""

from __future__ import annotations

import copy
import re
from typing import Any

ANSWER_SEP = " :: "


def split_answer_key(question_field: str) -> tuple[str | None, str]:
    """answers.question is stored as 'question_id :: question text'."""
    if ANSWER_SEP in question_field:
        qid, _, text = question_field.partition(ANSWER_SEP)
        return qid.strip(), text.strip()
    return None, question_field.strip()


def merge_answers(parsed: dict, answers: list[dict]) -> tuple[dict, dict[str, str]]:
    """Return (merged parsed copy, answered map id->answer). Only known
    question-id shapes mutate the structure; everything else is kept as an
    auxiliary fact for the summary/skills sections."""
    merged = copy.deepcopy(parsed)
    answered: dict[str, str] = {}

    for row in answers:
        qid, _ = split_answer_key(row["question"])
        answer = row["answer"].strip()
        if not qid or not answer:
            continue
        answered[qid] = answer
        if answer == "(skipped)":
            continue  # closes the gap, contributes no fact

        if qid == "contact_email":
            merged["contact"]["email"] = answer
        elif qid == "contact_phone":
            merged["contact"]["phone"] = answer
        elif qid == "contact_linkedin":
            merged["contact"]["linkedin"] = answer
        elif qid == "skills_list":
            new = [s.strip() for s in re.split(r"[,;]", answer) if s.strip()]
            existing_lower = {s.lower() for s in merged["sections"]["skills"]}
            merged["sections"]["skills"].extend(
                s for s in new if s.lower() not in existing_lower
            )
        elif qid.startswith("quant_"):
            # quant_<section>_<i>_<j>: attach the user's number to the bullet.
            m = re.match(r"quant_(experience|projects)_(\d+)_(\d+)$", qid)
            if m:
                section, i, j = m.group(1), int(m.group(2)), int(m.group(3))
                try:
                    bullet = merged["sections"][section][i]["bullets"][j]
                    merged["sections"][section][i]["bullets"][j] = f"{bullet} ({answer})"
                except (IndexError, KeyError):
                    pass
        elif qid.startswith("edu_dates_"):
            i = int(qid.rsplit("_", 1)[1])
            try:
                merged["sections"]["education"][i]["dates"] = answer
                merged["sections"]["education"][i]["header"].append(answer)
            except (IndexError, KeyError):
                pass

    return merged, answered


def source_corpus(parsed: dict, answers: list[dict]) -> str:
    """All text facts came from: used to verify no fabrication in output."""
    parts: list[str] = []

    def walk(obj: Any) -> None:
        if isinstance(obj, str):
            parts.append(obj)
        elif isinstance(obj, dict):
            for v in obj.values():
                walk(v)
        elif isinstance(obj, list):
            for v in obj:
                walk(v)

    walk(parsed)
    for row in answers:
        parts.append(row["answer"])
    return "\n".join(parts)
