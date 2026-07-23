"""Deterministic composer: fact store + structure spec -> markdown.

The markdown is the source of truth for rendering. Composition never invents:
every line is assembled from facts. The optional flash 'rewrite' gateway pass
may rephrase bullets, but any rewritten bullet that introduces a number or a
capitalized term absent from the source corpus is rejected in favor of the
deterministic one.
"""

from __future__ import annotations

import json
import re
from datetime import date

from llm.gateway import Gateway
from rewrite.facts import merge_answers, source_corpus
from structures.specs import STRUCTURES
from wizard.gaps import detect_gaps

DRAFT_WATERMARK = "DRAFT — answer the remaining wizard questions to finalize"

SECTION_TITLES = {
    "summary": "Summary",
    "skills": "Skills",
    "experience": "Experience",
    "projects": "Projects",
    "projects_and_internships": "Projects and Internships",
    "education": "Education",
    "certifications": "Certifications",
    "core_skills_expanded": "Skills",
}


def _entry_lines(entry: dict) -> list[str]:
    lines: list[str] = []
    header = [h for h in entry["header"] if h]
    if header:
        first = header[0]
        rest = " | ".join(header[1:])
        lines.append(f"**{first}**" + (f" — {rest}" if rest else ""))
    for bullet in entry["bullets"]:
        lines.append(f"- {bullet}")
    return lines


def compose_markdown(
    parsed: dict, answers: list[dict], structure_id: str
) -> tuple[str, str, list[dict]]:
    """Return (markdown, status draft|final, open_questions)."""
    spec = STRUCTURES.get(structure_id, STRUCTURES["S1"])
    merged, answered = merge_answers(parsed, answers)

    # FINAL requires zero open inputs: re-detect gaps on the merged facts and
    # drop the ones the user explicitly answered (incl. blank = "none exists",
    # which the wizard stores as no row — those stay open only if critical).
    open_questions = [
        q for q in detect_gaps(merged)
        if q["id"] not in answered and q["kind"] != "mc"  # MCs guide layout, not facts
    ]
    status = "final" if not open_questions else "draft"

    contact = merged["contact"]
    sections = merged["sections"]
    extras = merged.get("_extras", {})

    # If the user gave a sharper target role, use it to fill in the summary
    # when the parsed summary is missing or thin. NEVER overwrites a real
    # summary — only fills a gap. And only uses the words the user typed.
    if extras.get("target_role_focus") and not sections.get("summary"):
        sections["summary"] = extras["target_role_focus"]

    # User-volunteered "anything to add" text: append to summary as a second
    # sentence. This keeps the guarantee that all content comes from the user.
    if extras.get("additional_content"):
        add = extras["additional_content"].strip().rstrip(".")
        if add:
            sections["summary"] = (
                (sections.get("summary") or "").rstrip(".") + ". " + add + "."
            ).strip(". ") + "."

    out: list[str] = []

    if status == "draft":
        out.append(f"> {DRAFT_WATERMARK}")
        out.append("")

    for section in spec["section_order"]:
        if section == "contact":
            if contact.get("name"):
                out.append(f"# {contact['name']}")
            contact_bits = [
                contact.get("email"), contact.get("phone"),
                contact.get("linkedin"), contact.get("github"),
            ]
            line = " | ".join(b for b in contact_bits if b)
            if line:
                out.append(line)
            out.append("")
        elif section == "summary":
            if sections["summary"]:
                out.append("## Summary")
                out.append(sections["summary"])
                out.append("")
        elif section in ("skills", "core_skills_expanded"):
            if sections["skills"]:
                out.append("## Skills")
                out.append(", ".join(dict.fromkeys(sections["skills"])))
                out.append("")
        elif section == "experience":
            if sections["experience"]:
                out.append("## Experience")
                for entry in sections["experience"]:
                    out.extend(_entry_lines(entry))
                    out.append("")
        elif section == "projects":
            if sections["projects"]:
                out.append("## Projects")
                for entry in sections["projects"]:
                    out.extend(_entry_lines(entry))
                    out.append("")
        elif section == "projects_and_internships":
            entries = sections["projects"] + sections["experience"]
            if entries:
                out.append("## Projects and Internships")
                for entry in entries:
                    out.extend(_entry_lines(entry))
                    out.append("")
        elif section == "education":
            if sections["education"]:
                out.append("## Education")
                for entry in sections["education"]:
                    out.extend(_entry_lines(entry))
                    out.append("")
        elif section == "certifications":
            if sections["certifications"]:
                out.append("## Certifications")
                for cert in sections["certifications"]:
                    out.append(f"- {cert}")
                out.append("")

    markdown = "\n".join(out).strip() + "\n"
    return markdown, status, open_questions


# ------------------------------------------------------------- LLM polish

_NUM_RE = re.compile(r"\d+(?:[.,]\d+)?")
_CAP_RE = re.compile(r"\b[A-Z][a-zA-Z0-9+#.]*")


def _is_truthful(candidate: str, corpus: str) -> bool:
    """A rewritten bullet may not introduce numbers or capitalized terms that
    do not exist in the source corpus."""
    corpus_lower = corpus.lower()
    for num in _NUM_RE.findall(candidate):
        if num not in corpus:
            return False
    for term in _CAP_RE.findall(candidate):
        if term.lower() not in corpus_lower:
            return False
    return True


def polish_bullets(
    gateway: Gateway,
    user_id: str,
    markdown: str,
    parsed: dict,
    answers: list[dict],
    today: date,
) -> str:
    """One flash 'rewrite' pass over the bullet lines. Mock mode returns a
    non-JSON marker -> markdown unchanged. Real mode: each rewritten bullet is
    accepted only if it passes the truthfulness check."""
    bullets = [l for l in markdown.splitlines() if l.startswith("- ")]
    if not bullets:
        return markdown

    result = gateway.call(
        user_id=user_id,
        task="rewrite",
        content=json.dumps({"bullets": bullets, "markdown": markdown}, sort_keys=True),
        today=today,
    )
    try:
        rewritten = json.loads(result)
        assert isinstance(rewritten, dict)
    except (json.JSONDecodeError, AssertionError):
        return markdown

    corpus = source_corpus(parsed, answers)
    out = markdown
    for original, candidate in rewritten.items():
        if (
            isinstance(candidate, str)
            and original in out
            and candidate.startswith("- ")
            and len(candidate) < 300
            and _is_truthful(candidate, corpus)
        ):
            out = out.replace(original, candidate)
    return out
