"""Deterministic resume parser: raw text -> structured JSON. Zero LLM tokens.

Facts here are provenance 'parsed-from-upload'. The parser never invents
content: every value in the output is a substring of the input text.
"""

from __future__ import annotations

import re
from typing import Any

SECTION_ALIASES: dict[str, list[str]] = {
    "summary": ["summary", "professional summary", "profile", "objective", "about", "about me"],
    "skills": ["skills", "technical skills", "core skills", "key skills", "technologies", "tech stack"],
    "experience": [
        "experience", "work experience", "professional experience",
        "employment", "employment history", "work history", "internships",
    ],
    "education": ["education", "academics", "academic background", "qualifications"],
    "projects": ["projects", "personal projects", "side projects", "projects and internships", "academic projects"],
    "certifications": ["certifications", "certificates", "licenses", "licenses and certifications", "achievements"],
    "_contact": ["contact information", "contact details", "personal information", "personal details"],
}

_ALIAS_TO_SECTION = {
    alias: section for section, aliases in SECTION_ALIASES.items() for alias in aliases
}

EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
# 10-13 digits with space/hyphen separators, optional +CC and (area) prefix.
# Separators exclude newlines so year ranges across lines can never match.
PHONE_RE = re.compile(r"(?:\+\d{1,3}[ -]?)?(?:\(\d{2,5}\)[ -]?)?(?:\d[ -]?){9,12}\d")
LINKEDIN_RE = re.compile(r"(?:www\.)?linkedin\.com/[^\s|,)>]+", re.I)
GITHUB_RE = re.compile(r"(?:www\.)?github\.com/[^\s|,)>]+", re.I)
BULLET_RE = re.compile(r"^\s*[•●▪◦‣·*+-]\s+")
DATE_RANGE_RE = re.compile(
    r"(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*'?\d{2,4}"
    r"|\b(?:19|20)\d{2}\b",
    re.I,
)
PLACEHOLDER_RE = re.compile(r"\[[^\]]{1,40}\]|\bTBD\b|\bXXX+\b|\blorem\b", re.I)


def _heading_key(line: str) -> str | None:
    """Return the canonical section for a line if it looks like a heading."""
    stripped = line.strip().rstrip(":").strip()
    if not stripped or len(stripped) > 40:
        return None
    return _ALIAS_TO_SECTION.get(stripped.lower())


def _clean_bullet(line: str) -> str:
    return BULLET_RE.sub("", line).strip()


_TERMINAL_PUNCT = ".!?:;)"


def _is_bullet_continuation(prev_bullet: str, line: str) -> bool:
    """A non-bullet line that continues a wrapped bullet, not a new entry.

    PDF text wrapping splits one logical bullet across lines; the continuation
    lacks a marker and its predecessor lacks terminal punctuation. Guard against
    swallowing a real job title: the line must not carry a date and must not
    look like a titled header ("Role | Company", "Role — Company").
    """
    if not prev_bullet:
        return False
    if prev_bullet.rstrip()[-1:] in _TERMINAL_PUNCT:
        return False
    if DATE_RANGE_RE.search(line):
        return False
    if " | " in line or " — " in line:
        return False
    return True


def _merge_continuation(prev_bullet: str, line: str) -> str:
    """Join a wrapped bullet with its continuation. A trailing hyphen means a
    soft word-break ("e-" + "commerce" -> "e-commerce"); otherwise add a space."""
    prev = prev_bullet.rstrip()
    if prev.endswith("-"):
        return prev + line.lstrip()
    return prev + " " + line.lstrip()


def _split_entries(lines: list[str]) -> list[dict[str, Any]]:
    """Group experience/education/project lines into entries. A new entry
    starts at a non-bullet line that follows bullets, or a line with a date
    range when the current entry already has one. Wrapped-bullet continuation
    lines are merged back into the preceding bullet rather than mis-read as a
    new entry header."""
    entries: list[dict[str, Any]] = []
    current: dict[str, Any] | None = None

    # Work over non-empty lines with lookahead so a continuation can be told
    # apart from a real next-entry header.
    items = [ln for ln in lines if ln.strip()]
    for idx, line in enumerate(items):
        stripped = line.strip()
        is_bullet = bool(BULLET_RE.match(line))
        has_date = bool(DATE_RANGE_RE.search(stripped))

        if is_bullet:
            if current is None:
                current = {"header": [], "dates": None, "bullets": []}
            current["bullets"].append(_clean_bullet(line))
            continue

        # Wrapped-bullet continuation: fold back into the last bullet instead of
        # starting a spurious entry (fixes "Framework Core." / "commerce ...").
        # Only when the NEXT line is itself a bullet — a real entry header is
        # followed by a company/date line, not by a bullet, so this guard keeps
        # us from swallowing legitimate job titles.
        next_is_bullet = (
            idx + 1 < len(items) and bool(BULLET_RE.match(items[idx + 1]))
        )
        if (
            current is not None
            and current["bullets"]
            and next_is_bullet
            and _is_bullet_continuation(current["bullets"][-1], stripped)
        ):
            current["bullets"][-1] = _merge_continuation(
                current["bullets"][-1], stripped
            )
            continue

        starts_new = (
            current is None
            or current["bullets"]  # header lines after bullets => next entry
            or (has_date and current["dates"] is not None)
        )
        if starts_new:
            if current is not None:
                entries.append(current)
            current = {"header": [], "dates": None, "bullets": []}
        current["header"].append(stripped)
        if has_date and current["dates"] is None:
            match_from = DATE_RANGE_RE.search(stripped)
            current["dates"] = stripped[match_from.start():].strip() if match_from else None

    if current is not None:
        entries.append(current)
    return entries


def _parse_skills(lines: list[str]) -> list[str]:
    skills: list[str] = []
    for line in lines:
        cleaned = _clean_bullet(line)
        if not cleaned:
            continue
        # "Category: a, b, c" keeps the category as context per skill line.
        body = cleaned.split(":", 1)[1] if ":" in cleaned and len(cleaned.split(":", 1)[0]) < 30 else cleaned
        for part in re.split(r"[,|/;]| {2,}", body):
            part = part.strip(" .•")
            if part and len(part) < 60:
                skills.append(part)
    return skills


def parse_resume(text: str) -> dict[str, Any]:
    lines = text.splitlines()

    # --- contact: regexes over the whole doc; name from the top block
    email = EMAIL_RE.search(text)
    phone = PHONE_RE.search(text)
    linkedin = LINKEDIN_RE.search(text)
    github = GITHUB_RE.search(text)

    name: str | None = None
    for line in lines[:5]:
        stripped = line.strip()
        if not stripped:
            continue
        if EMAIL_RE.search(stripped) or LINKEDIN_RE.search(stripped):
            continue
        if _heading_key(stripped):
            continue
        if 1 <= len(stripped.split()) <= 5 and not any(c.isdigit() for c in stripped):
            name = stripped
        break

    # --- split into sections by headings
    sections_raw: dict[str, list[str]] = {}
    unclassified: list[str] = []
    current_section: str | None = None
    for line in lines:
        key = _heading_key(line)
        if key:
            current_section = key
            sections_raw.setdefault(current_section, [])
            continue
        if current_section:
            sections_raw[current_section].append(line)
        elif line.strip():
            unclassified.append(line.strip())

    summary_lines = [l.strip() for l in sections_raw.get("summary", []) if l.strip()]
    bullets_total = sum(1 for l in lines if BULLET_RE.match(l))

    parsed: dict[str, Any] = {
        "contact": {
            "name": name,
            "email": email.group(0) if email else None,
            "phone": phone.group(0).strip() if phone else None,
            "linkedin": linkedin.group(0) if linkedin else None,
            "github": github.group(0) if github else None,
        },
        "sections": {
            "summary": " ".join(summary_lines) or None,
            "skills": _parse_skills(sections_raw.get("skills", [])),
            "experience": _split_entries(sections_raw.get("experience", [])),
            "education": _split_entries(sections_raw.get("education", [])),
            "projects": _split_entries(sections_raw.get("projects", [])),
            "certifications": [
                _clean_bullet(l) for l in sections_raw.get("certifications", []) if l.strip()
            ],
        },
        "flags": {
            "has_placeholders": bool(PLACEHOLDER_RE.search(text)),
            "sections_found": sorted(sections_raw.keys()),
        },
        "stats": {
            "line_count": len([l for l in lines if l.strip()]),
            "bullet_count": bullets_total,
        },
    }
    return parsed
