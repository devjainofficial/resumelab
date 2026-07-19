"""External feedback -> structured findings.

Two intake paths:
- pasted text: deterministic category matching (zero tokens)
- screenshot: one flash vision pass through the gateway; its output is then
  normalized through the SAME deterministic mapper, so the LLM can only ever
  contribute category labels and counts, never patches or facts.
"""

from __future__ import annotations

import base64
import hashlib
import json
import re
from datetime import date
from typing import Any

from llm.gateway import Gateway

# category -> trigger phrases seen in external checkers (Resume Worded et al.)
CATEGORY_TRIGGERS: dict[str, list[str]] = {
    "quantify": ["quantify", "quantif", "impact numbers", "add numbers", "metrics missing"],
    "buzzwords": ["buzzword", "cliche", "cliché", "overused", "filler words"],
    "verb_repetition": ["repetition", "repeated", "same verb", "verb variety"],
    "weak_verbs": ["weak verb", "stronger verb", "action verb"],
    "pronouns": ["personal pronoun", "first person", "pronoun"],
    "passive": ["passive voice", "passive language"],
    "length": ["length", "too long", "page limit", "shorten"],
    "readability": ["readability", "long sentence", "dense"],
}

COUNT_RE = re.compile(r"[:\-–]\s*(\d{1,3})\b|\((\d{1,3})\)")


def classify_line(line: str) -> str | None:
    lower = line.lower()
    for category, triggers in CATEGORY_TRIGGERS.items():
        if any(t in lower for t in triggers):
            return category
    return None


def parse_text_findings(text: str) -> list[dict[str, Any]]:
    """Deterministic: each line that matches a known category becomes one
    finding {category, count?, source_line}. Unknown lines are ignored (we
    never patch what we can't classify)."""
    findings: list[dict[str, Any]] = []
    seen: set[str] = set()
    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            continue
        category = classify_line(line)
        if not category or category in seen:
            continue
        seen.add(category)
        m = COUNT_RE.search(line)
        count = int(next(g for g in m.groups() if g)) if m else None
        findings.append({"category": category, "count": count, "source_line": line})
    return findings


def findings_from_screenshot(
    gateway: Gateway, user_id: str, image_bytes: bytes, today: date
) -> tuple[list[dict[str, Any]], str | None]:
    """Vision extraction via the gateway (flash tier, cached by image hash).
    Returns (findings, note). Mock mode returns no findings with a note —
    dev/CI never pretend to have read a screenshot."""
    digest = hashlib.sha256(image_bytes).hexdigest()
    content = json.dumps({
        "kind": "resume_worded_screenshot",
        "image_sha256": digest,
        "image_b64_prefix": base64.b64encode(image_bytes[:64]).decode(),
    }, sort_keys=True)
    result = gateway.call(
        user_id=user_id, task="screenshot_extract", content=content, today=today
    )
    try:
        payload = json.loads(result)
        assert isinstance(payload, list)
    except (json.JSONDecodeError, AssertionError):
        return [], (
            "Screenshot reading needs the live model (dev runs use the mock "
            "gateway). Paste the findings as text instead."
        )

    # Normalize through the same deterministic mapper: unknown categories die
    # here, counts are clamped to sane integers.
    findings: list[dict[str, Any]] = []
    seen: set[str] = set()
    for item in payload:
        if not isinstance(item, dict):
            continue
        category = classify_line(str(item.get("category", "")))
        if not category or category in seen:
            continue
        seen.add(category)
        count = item.get("count")
        count = int(count) if isinstance(count, (int, float)) and 0 < count < 1000 else None
        findings.append({
            "category": category,
            "count": count,
            "source_line": f"screenshot: {item.get('category')}",
        })
    return findings, None
