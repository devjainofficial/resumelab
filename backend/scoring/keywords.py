"""Deterministic keyword extraction and coverage math. Zero LLM tokens.
Shared by the scorer (slice 5) and the JD enhancer (slice 7)."""

from __future__ import annotations

import re
from collections import Counter

STOPWORDS = frozenset(
    """a an and are as at be been but by can could do does for from has have how
    in into is it its more most of on or our so than that the their them they
    this to was we well were what when which while who will with within would
    you your must should nice plus etc via able strong work team experience
    years developing looking join required requirements responsibilities role
    candidate ideal preferred qualifications skills knowledge using ability
    including help build working develop development engineer engineers
    """.split()
)

TOKEN_RE = re.compile(r"[a-zA-Z][a-zA-Z0-9+#.]{1,}")


def extract_keywords(jd_text: str, top_n: int = 25) -> list[str]:
    """Most frequent non-stopword terms of the JD, order = importance."""
    tokens = [t.lower().rstrip(".") for t in TOKEN_RE.findall(jd_text)]
    counts = Counter(t for t in tokens if t not in STOPWORDS and len(t) >= 3)
    return [t for t, _ in counts.most_common(top_n)]


def coverage(resume_text: str, keywords: list[str]) -> tuple[float, list[str], list[str]]:
    """Return (ratio, present, missing)."""
    if not keywords:
        return 1.0, [], []
    haystack = resume_text.lower()
    present = [k for k in keywords if k in haystack]
    missing = [k for k in keywords if k not in haystack]
    return len(present) / len(keywords), present, missing
