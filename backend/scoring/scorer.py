"""Built-in ATS scorer: deterministic, free, 0-100 with a readable per-check
breakdown. Ported from the resume-lab Phase 5 gates. DRAFTs cannot be scored.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from parsing.extract import extract_text_from_pdf, page_count_pdf
from parsing.parser import PLACEHOLDER_RE
from rewrite.renderer import render_pdf
from scoring.keywords import coverage, extract_keywords

STANDARD_HEADINGS = {
    "summary", "skills", "experience", "education", "certifications",
    "projects", "projects and internships",
}

ACTION_VERB_HINTS = {
    "led", "built", "created", "designed", "developed", "implemented",
    "launched", "managed", "improved", "reduced", "increased", "shipped",
    "migrated", "automated", "optimized", "delivered", "owned", "drove",
    "cut", "grew", "scaled", "introduced", "refactored", "maintained",
    "architected", "mentored", "established", "streamlined", "helped",
    "wrote", "tested", "deployed", "integrated", "analyzed", "won",
}


@dataclass
class Check:
    id: str
    label: str
    points: float
    max_points: float
    detail: str

    def as_dict(self) -> dict:
        return {
            "id": self.id,
            "label": self.label,
            "points": round(self.points, 1),
            "max_points": self.max_points,
            "detail": self.detail,
        }


def _bullets(markdown: str) -> list[str]:
    return [l[2:].strip() for l in markdown.splitlines() if l.startswith("- ")]


def _experience_bullets(markdown: str) -> list[str]:
    """Bullets under Experience/Projects headings (quantification target)."""
    out: list[str] = []
    section = None
    for line in markdown.splitlines():
        if line.startswith("## "):
            section = line[3:].strip().lower()
        elif line.startswith("- ") and section in (
            "experience", "projects", "projects and internships"
        ):
            out.append(line[2:].strip())
    return out


def _verb_first(bullet: str) -> bool:
    first = re.split(r"\W+", bullet.strip(), 1)[0].lower()
    return first in ACTION_VERB_HINTS or first.endswith("ed")


def score_resume(markdown: str, jd_text: str | None = None) -> dict:
    """Score a FINAL markdown. Returns {value, checks: [...]}. Deterministic:
    same input -> same score, zero LLM tokens."""
    checks: list[Check] = []
    pdf = render_pdf(markdown)
    pdf_text = extract_text_from_pdf(pdf)

    # 1. Parse-back fidelity (15)
    md_words = set(re.findall(r"[A-Za-z0-9]{3,}", markdown))
    pdf_words = set(re.findall(r"[A-Za-z0-9]{3,}", pdf_text))
    ratio = 1 - len(md_words - pdf_words) / max(1, len(md_words))
    checks.append(Check(
        "parse_back", "Text survives PDF rendering", 15 * min(1.0, ratio / 0.95), 15,
        f"{ratio:.0%} of source words recovered from the rendered PDF",
    ))

    # 2. Exactly one page (10)
    pages = page_count_pdf(pdf)
    checks.append(Check(
        "one_page", "Exactly one page", 10.0 if pages == 1 else 0.0, 10,
        f"{pages} page(s)",
    ))

    # 3. Standard headings only (5)
    headings = [l[3:].strip().lower() for l in markdown.splitlines() if l.startswith("## ")]
    nonstandard = [h for h in headings if h not in STANDARD_HEADINGS]
    checks.append(Check(
        "headings", "Standard section headings", 5.0 if headings and not nonstandard else 0.0, 5,
        "all standard" if not nonstandard else f"nonstandard: {nonstandard}",
    ))

    # 4. Contact completeness: email, phone, LinkedIn (15)
    head = "\n".join(markdown.splitlines()[:6])
    has_email = bool(re.search(r"[\w.+-]+@[\w-]+\.[\w.]+", head))
    has_phone = bool(re.search(r"(?:\+\d{1,3}[ -]?)?(?:\d[ -]?){9,12}\d", head))
    has_linkedin = "linkedin.com/" in head.lower()
    got = sum([has_email, has_phone, has_linkedin])
    checks.append(Check(
        "contact", "Contact info complete (email, phone, LinkedIn)", got * 5.0, 15,
        f"email={has_email}, phone={has_phone}, linkedin={has_linkedin}",
    ))

    # 5. Bullet lint (25): verb-first 10, <=40 words 5, verb variety 5, quantification 5->weighted
    bullets = _bullets(markdown)
    exp_bullets = _experience_bullets(markdown)
    if bullets:
        vf_ratio = sum(_verb_first(b) for b in bullets) / len(bullets)
        checks.append(Check(
            "verb_first", "Bullets start with action verbs", 10 * vf_ratio, 10,
            f"{vf_ratio:.0%} verb-first",
        ))
        over = [b for b in bullets if len(b.split()) > 40]
        checks.append(Check(
            "bullet_length", "Bullets at most 40 words", 5.0 if not over else 0.0, 5,
            "all within limit" if not over else f"{len(over)} over 40 words",
        ))
        firsts = [re.split(r"\W+", b, 1)[0].lower() for b in bullets]
        repeats = len(firsts) - len(set(firsts))
        variety = max(0.0, 1 - repeats / max(1, len(firsts)))
        checks.append(Check(
            "verb_variety", "Opening verbs vary", 5 * variety, 5,
            f"{len(set(firsts))} distinct verbs across {len(firsts)} bullets",
        ))
    else:
        checks.append(Check("verb_first", "Bullets start with action verbs", 0, 10, "no bullets found"))
        checks.append(Check("bullet_length", "Bullets at most 40 words", 0, 5, "no bullets found"))
        checks.append(Check("verb_variety", "Opening verbs vary", 0, 5, "no bullets found"))

    if exp_bullets:
        q_ratio = sum(bool(re.search(r"\d", b)) for b in exp_bullets) / len(exp_bullets)
        target = 2 / 3
        checks.append(Check(
            "quantified", "Numbers in at least 2/3 of experience bullets",
            10 * min(1.0, q_ratio / target), 10,
            f"{q_ratio:.0%} of experience bullets carry a number",
        ))
    else:
        checks.append(Check("quantified", "Numbers in at least 2/3 of experience bullets", 0, 10, "no experience bullets"))

    # 5b. Content depth (10): recruiters and ATS rankers penalize thin resumes
    depth_bullets = 6 * min(1.0, len(exp_bullets) / 6)
    summary_line = ""
    lines = markdown.splitlines()
    for i, line in enumerate(lines):
        if line.strip().lower() == "## summary" and i + 1 < len(lines):
            summary_line = lines[i + 1]
            break
    depth_summary = 2.0 if len(summary_line.split()) >= 8 else 0.0
    skills_terms = 0
    for i, line in enumerate(lines):
        if line.strip().lower() == "## skills" and i + 1 < len(lines):
            skills_terms = len([s for s in lines[i + 1].split(",") if s.strip()])
            break
    depth_skills = 2.0 if skills_terms >= 5 else 0.0
    checks.append(Check(
        "depth", "Enough substance (bullets, summary, skills)",
        depth_bullets + depth_summary + depth_skills, 10,
        f"{len(exp_bullets)} experience/project bullets (target 6+), "
        f"summary {'ok' if depth_summary else 'thin'}, {skills_terms} skills listed",
    ))

    # 6. Keyword coverage vs JD (10; awarded fully when no JD provided)
    if jd_text:
        kws = extract_keywords(jd_text)
        ratio_kw, present, missing = coverage(markdown, kws)
        checks.append(Check(
            "keywords", "Job-description keyword coverage", 10 * ratio_kw, 10,
            f"{len(present)}/{len(kws)} keywords present; missing: {', '.join(missing[:8])}",
        ))
    else:
        checks.append(Check(
            "keywords", "Job-description keyword coverage", 10, 10,
            "no JD provided — add one for a targeted score",
        ))

    # 7. Zero placeholder markers (5)
    placeholders = PLACEHOLDER_RE.findall(markdown)
    real_placeholders = [p for p in placeholders if p != "(skipped)"]
    checks.append(Check(
        "placeholders", "No placeholder markers", 5.0 if not real_placeholders else 0.0, 5,
        "clean" if not real_placeholders else f"found: {real_placeholders[:5]}",
    ))

    value = round(sum(c.points for c in checks))
    return {"value": max(0, min(100, value)), "checks": [c.as_dict() for c in checks]}
