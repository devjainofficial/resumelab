"""Targeted patches per finding type. NEVER a full rewrite: only offending
lines change, everything else stays byte-identical. A finding that needs a
number produces a wizard question, never a number."""

from __future__ import annotations

import json
import re
from datetime import date
from typing import Any

from llm.gateway import Gateway
from rewrite.composer import _is_truthful
from rewrite.facts import source_corpus

BUZZWORD_PHRASES = [
    "results-driven", "results driven", "team player", "hard-working",
    "hard working", "go-getter", "self-starter", "self starter", "synergy",
    "dynamic", "detail-oriented", "detail oriented", "think outside the box",
    "outside the box", "passionate", "highly motivated", "motivated",
    "proactive", "seasoned", "guru", "ninja", "rockstar", "world-class",
    "best-in-class", "cutting-edge", "responsible for",
]

PRONOUN_RE = re.compile(r"\b(I|me|my|mine|we|our)\b\s*", re.IGNORECASE)


def _clean_spacing(line: str) -> str:
    line = re.sub(r"\s{2,}", " ", line)
    line = re.sub(r"\s+([,.;])", r"\1", line)
    line = re.sub(r"^- ,?\s*", "- ", line)
    return line.rstrip()


def apply_repairs(
    markdown: str,
    findings: list[dict[str, Any]],
    parsed: dict,
    answers: list[dict],
    gateway: Gateway,
    user_id: str,
    today: date,
) -> dict[str, Any]:
    """Return {markdown, actions, new_questions}. Patches are per-line and
    per-finding; untouched lines are byte-identical to the input."""
    lines = markdown.splitlines()
    actions: list[str] = []
    new_questions: list[dict[str, Any]] = []
    categories = {f["category"] for f in findings}

    # ---- buzzwords: deterministic deletions on offending lines only
    if "buzzwords" in categories:
        pattern = re.compile(
            "|".join(re.escape(p) for p in BUZZWORD_PHRASES), re.IGNORECASE
        )
        removed: set[str] = set()
        for i, line in enumerate(lines):
            if line.startswith(("- ", "#")) or line.strip():
                hits = pattern.findall(line)
                if hits and (line.startswith("- ") or not line.startswith("#")):
                    new_line = _clean_spacing(pattern.sub("", line))
                    if new_line != line:
                        lines[i] = new_line
                        removed.update(h.lower() for h in hits)
        if removed:
            actions.append(f"Removed buzzwords: {', '.join(sorted(removed))}")

    # ---- pronouns: deterministic deletion
    if "pronouns" in categories:
        changed = 0
        for i, line in enumerate(lines):
            if line.startswith("- ") and PRONOUN_RE.search(line):
                lines[i] = _clean_spacing(PRONOUN_RE.sub("", line))
                changed += 1
        if changed:
            actions.append(f"Removed personal pronouns from {changed} bullet(s)")

    # ---- quantify: a missing number is a QUESTION, never a guess
    if "quantify" in categories:
        section = None
        exp_idx = -1
        for line in lines:
            if line.startswith("## "):
                section = line[3:].strip().lower()
                continue
            if line.startswith("- ") and section in (
                "experience", "projects", "projects and internships"
            ):
                exp_idx += 1
                bullet = line[2:].strip()
                if not re.search(r"\d", bullet):
                    new_questions.append({
                        "id": f"repair_quant_{exp_idx}",
                        "kind": "number",
                        "question": (
                            f'For "{bullet}" — give one real number that shows the '
                            "impact (people, users, %, amount, or time). "
                            "Leave blank if none exists."
                        ),
                        "score_impact": 6,
                    })
        if new_questions:
            actions.append(
                f"Quantification needs your real numbers: {len(new_questions)} "
                "question(s) added to the wizard — nothing was invented"
            )

    # ---- verb repetition / weak verbs: targeted flash rewrite, truth-checked
    if categories & {"verb_repetition", "weak_verbs"}:
        bullet_lines = [l for l in lines if l.startswith("- ")]
        firsts: dict[str, int] = {}
        for b in bullet_lines:
            first = re.split(r"\W+", b[2:].strip(), 1)[0].lower()
            firsts[first] = firsts.get(first, 0) + 1
        offenders = [
            b for b in bullet_lines
            if firsts[re.split(r"\W+", b[2:].strip(), 1)[0].lower()] > 1
        ] if "verb_repetition" in categories else bullet_lines
        if offenders:
            result = gateway.call(
                user_id=user_id,
                task="repair",
                content=json.dumps({"fix": "verb_variety", "bullets": offenders}, sort_keys=True),
                today=today,
            )
            corpus = source_corpus(parsed, answers)
            replaced = 0
            try:
                mapping = json.loads(result)
                assert isinstance(mapping, dict)
            except (json.JSONDecodeError, AssertionError):
                mapping = {}
            for original, candidate in mapping.items():
                if (
                    isinstance(candidate, str)
                    and candidate.startswith("- ")
                    and original in lines
                    and _is_truthful(candidate, corpus)
                ):
                    lines[lines.index(original)] = candidate
                    replaced += 1
            if replaced:
                actions.append(f"Reworded {replaced} bullet(s) for verb variety")
            elif mapping == {}:
                actions.append(
                    "Verb-variety rewording needs the live model — run again "
                    "once real generation is enabled"
                )

    return {
        "markdown": "\n".join(lines) + ("\n" if markdown.endswith("\n") else ""),
        "actions": actions,
        "new_questions": new_questions,
    }
