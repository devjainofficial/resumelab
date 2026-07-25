"""Built-in ATS scorer: deterministic, free, 0-100 with a readable per-check
breakdown. DRAFTs cannot be scored.

Calibration philosophy: match the harshness of tools like Resume Worded so
users don't see a wildly generous internal score. Structural checks (does it
parse, is it one page, is contact info present) earn baseline points but
cannot on their own push a weak resume to 80+. Real quality comes from
achievement-oriented, quantified bullets in confident language.
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
    "architected", "mentored", "established", "streamlined",
    "wrote", "tested", "deployed", "integrated", "analyzed", "won",
    "spearheaded", "orchestrated", "engineered", "pioneered", "transformed",
    "accelerated", "generated", "trained", "coached", "negotiated",
}

# Phrases that signal passive / low-agency writing. Resume Worded penalizes
# these heavily — they read as "I was there" instead of "I did X."
WEAK_PHRASES = [
    "responsible for", "in charge of", "duties included", "duties were",
    "tasked with", "worked on", "worked with", "worked as",
    "helped with", "helped to", "assisted with", "assisted in",
    "involved in", "participated in", "contributed to", "engaged in",
    "part of the team that", "member of a team", "team that",
    "gained experience", "exposure to", "familiar with", "knowledge of",
    "handled", "dealt with", "supported the",
]

# Clichés and personality traits. These are subjective, unverifiable, and
# every recruiter has seen them a thousand times.
BUZZWORDS = [
    "team player", "team-player", "detail oriented", "detail-oriented",
    "hard working", "hard-working", "hardworking",
    "passionate", "passionate about", "self starter", "self-starter",
    "self motivated", "self-motivated", "results driven", "results-driven",
    "results oriented", "results-oriented", "go getter", "go-getter",
    "think outside the box", "outside the box", "synergy", "synergies",
    "leverage", "leveraging", "utilize", "utilized", "utilizing",
    "strategic thinker", "big picture", "big-picture", "quick learner",
    "fast learner", "highly motivated", "motivated individual",
    "dynamic", "proactive", "innovative", "creative individual",
    "problem solver", "problem-solver", "excellent communication",
    "excellent communication skills", "strong work ethic", "value add",
    "value-add", "seasoned", "guru", "ninja", "rockstar",
]

# Result/impact signals that mark achievement-oriented bullets.
IMPACT_SIGNALS = [
    r"\d+\s*%",           # 30%
    r"\d[\d,]*\s*(?:k|m|million|thousand|users|customers|requests|deploys?|hours?)",
    r"\$\s*\d",           # $50, $1M
    r"₹\s*\d",            # ₹50L, ₹2M
    r"\bby\s+\d",         # "by 30%"
    r"\bto\s+\d",         # "to 500"
    r"\bfrom\s+\d.*\bto\s+\d",  # "from 200ms to 50ms"
    r"\bresulting in\b", r"\bleading to\b", r"\bwhich (?:led|resulted)\b",
    r"\bsaved\b", r"\bearned\b",
    r"\bincreased\b.*\bby\b", r"\breduced\b.*\bby\b",
    r"\bimproved\b.*\bby\b", r"\bcut\b.*\bby\b",
    r"\bgrew\b.*\b(?:by|to)\b", r"\bscaled\b.*\bto\b",
]
_IMPACT_RE = re.compile("|".join(IMPACT_SIGNALS), re.IGNORECASE)


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


def _count_weak_phrases(text: str) -> tuple[int, list[str]]:
    text_low = " " + text.lower() + " "
    found: list[str] = []
    for phrase in WEAK_PHRASES:
        # Match on word boundaries.
        pattern = r"\b" + re.escape(phrase) + r"\b"
        matches = re.findall(pattern, text_low)
        if matches:
            found.extend([phrase] * len(matches))
    return len(found), found[:5]


def _count_buzzwords(text: str) -> tuple[int, list[str]]:
    text_low = " " + text.lower() + " "
    found: list[str] = []
    for phrase in BUZZWORDS:
        pattern = r"\b" + re.escape(phrase) + r"\b"
        matches = re.findall(pattern, text_low)
        if matches:
            found.extend([phrase] * len(matches))
    return len(found), found[:5]


def _has_impact_signal(bullet: str) -> bool:
    return bool(_IMPACT_RE.search(bullet))


def score_resume(
    markdown: str, jd_text: str | None = None, structure_id: str = "S1"
) -> dict:
    """Score a FINAL markdown. Returns {value, checks: [...]}. Deterministic:
    same input -> same score, zero LLM tokens."""
    checks: list[Check] = []
    pdf = render_pdf(markdown, structure_id)
    pdf_text = extract_text_from_pdf(pdf)
    bullets = _bullets(markdown)
    exp_bullets = _experience_bullets(markdown)

    # --- Structural (must-pass) — 25 total ------------------------------
    # 1. Parse-back fidelity (8)
    md_words = set(re.findall(r"[A-Za-z0-9]{3,}", markdown))
    pdf_words = set(re.findall(r"[A-Za-z0-9]{3,}", pdf_text))
    ratio = 1 - len(md_words - pdf_words) / max(1, len(md_words))
    checks.append(Check(
        "parse_back", "Text survives PDF rendering", 8 * min(1.0, ratio / 0.95), 8,
        f"{ratio:.0%} of source words recovered from the rendered PDF",
    ))

    # 2. Exactly one page (6)
    pages = page_count_pdf(pdf)
    checks.append(Check(
        "one_page", "Exactly one page", 6.0 if pages == 1 else 0.0, 6,
        f"{pages} page(s)",
    ))

    # 3. Standard headings only (3)
    headings = [l[3:].strip().lower() for l in markdown.splitlines() if l.startswith("## ")]
    nonstandard = [h for h in headings if h not in STANDARD_HEADINGS]
    checks.append(Check(
        "headings", "Standard section headings", 3.0 if headings and not nonstandard else 0.0, 3,
        "all standard" if not nonstandard else f"nonstandard: {nonstandard}",
    ))

    # 4. Contact completeness (8)
    head = "\n".join(markdown.splitlines()[:6])
    has_email = bool(re.search(r"[\w.+-]+@[\w-]+\.[\w.]+", head))
    has_phone = bool(re.search(r"(?:\+\d{1,3}[ -]?)?(?:\d[ -]?){9,12}\d", head))
    has_linkedin = "linkedin.com/" in head.lower()
    got = sum([has_email, has_phone, has_linkedin])
    checks.append(Check(
        "contact", "Contact info complete (email, phone, LinkedIn)",
        got * (8 / 3), 8,
        f"email={has_email}, phone={has_phone}, linkedin={has_linkedin}",
    ))

    # --- Bullet quality — 40 total --------------------------------------
    # 5. Verb-first (7)
    if bullets:
        vf_ratio = sum(_verb_first(b) for b in bullets) / len(bullets)
        checks.append(Check(
            "verb_first", "Bullets start with strong action verbs", 7 * vf_ratio, 7,
            f"{vf_ratio:.0%} verb-first",
        ))
    else:
        checks.append(Check("verb_first", "Bullets start with strong action verbs", 0, 7, "no bullets found"))

    # 6. Bullet length (3)
    if bullets:
        over = [b for b in bullets if len(b.split()) > 40]
        checks.append(Check(
            "bullet_length", "Bullets at most 40 words", 3.0 if not over else 0.0, 3,
            "all within limit" if not over else f"{len(over)} over 40 words",
        ))
    else:
        checks.append(Check("bullet_length", "Bullets at most 40 words", 0, 3, "no bullets found"))

    # 7. Verb variety (5)
    if bullets:
        firsts = [re.split(r"\W+", b, 1)[0].lower() for b in bullets]
        repeats = len(firsts) - len(set(firsts))
        variety = max(0.0, 1 - repeats / max(1, len(firsts)))
        checks.append(Check(
            "verb_variety", "Opening verbs vary", 5 * variety, 5,
            f"{len(set(firsts))} distinct verbs across {len(firsts)} bullets",
        ))
    else:
        checks.append(Check("verb_variety", "Opening verbs vary", 0, 5, "no bullets found"))

    # 8. Weak-verb / passive phrases (10 penalty-based)
    weak_count, weak_examples = _count_weak_phrases(markdown)
    # 0 → full, 1 → -3, 2 → -6, 3+ → 0
    weak_pts = max(0.0, 10 - weak_count * 3.5)
    checks.append(Check(
        "weak_language", "Confident language (no 'responsible for', 'worked on')",
        weak_pts, 10,
        "clean" if not weak_count
        else f"{weak_count} weak phrase(s): {', '.join(weak_examples)}",
    ))

    # 9. Achievement-oriented bullets (15)
    if exp_bullets:
        impact_ratio = sum(_has_impact_signal(b) for b in exp_bullets) / len(exp_bullets)
        # target 80% for full marks
        pts = 15 * min(1.0, impact_ratio / 0.8)
        checks.append(Check(
            "achievement", "Bullets show measurable impact (numbers, %, results)",
            pts, 15,
            f"{impact_ratio:.0%} of experience bullets show a result or metric",
        ))
    else:
        checks.append(Check("achievement", "Bullets show measurable impact", 0, 15, "no experience bullets"))

    # --- Content quality — 20 total -------------------------------------
    # 10. Buzzwords / clichés (6 penalty-based)
    buzz_count, buzz_examples = _count_buzzwords(markdown)
    buzz_pts = max(0.0, 6 - buzz_count * 2.0)
    checks.append(Check(
        "buzzwords", "No overused buzzwords or personality traits",
        buzz_pts, 6,
        "clean" if not buzz_count
        else f"{buzz_count} buzzword(s): {', '.join(buzz_examples)}",
    ))

    # 11. Depth (8)
    depth_bullets = 4 * min(1.0, len(exp_bullets) / 6)
    summary_line = ""
    lines = markdown.splitlines()
    for i, line in enumerate(lines):
        if line.strip().lower() == "## summary" and i + 1 < len(lines):
            summary_line = lines[i + 1]
            break
    depth_summary = 2.0 if len(summary_line.split()) >= 12 else (1.0 if len(summary_line.split()) >= 8 else 0.0)
    skills_terms = 0
    for i, line in enumerate(lines):
        if line.strip().lower() == "## skills" and i + 1 < len(lines):
            skills_terms = len([s for s in lines[i + 1].split(",") if s.strip()])
            break
    depth_skills = 2.0 if skills_terms >= 8 else (1.0 if skills_terms >= 5 else 0.0)
    checks.append(Check(
        "depth", "Enough substance (bullets, summary, skills)",
        depth_bullets + depth_summary + depth_skills, 8,
        f"{len(exp_bullets)} bullets (target 6+), "
        f"summary {len(summary_line.split())}w, {skills_terms} skills",
    ))

    # 12. No placeholders (3)
    placeholders = PLACEHOLDER_RE.findall(markdown)
    real_placeholders = [p for p in placeholders if p != "(skipped)"]
    checks.append(Check(
        "placeholders", "No placeholder markers", 3.0 if not real_placeholders else 0.0, 3,
        "clean" if not real_placeholders else f"found: {real_placeholders[:5]}",
    ))

    # 13. Sentence-start variety across bullets (3)
    if len(bullets) >= 4:
        firsts = [b.split()[0].lower() if b.split() else "" for b in bullets]
        most_common_count = max(firsts.count(f) for f in set(firsts))
        # Penalize if the same starting word appears in >30% of bullets
        overuse_ratio = most_common_count / len(bullets)
        variety_pts = 3.0 if overuse_ratio <= 0.3 else max(0.0, 3.0 * (1 - (overuse_ratio - 0.3) * 3))
        checks.append(Check(
            "start_variety", "Bullets don't overuse the same opening word",
            variety_pts, 3,
            f"most-used first word appears in {overuse_ratio:.0%} of bullets",
        ))
    else:
        checks.append(Check("start_variety", "Bullets don't overuse the same opening word", 3, 3, "too few bullets to score"))

    # --- JD keyword coverage — 15 (or 8 baseline without JD) ------------
    if jd_text:
        kws = extract_keywords(jd_text)
        ratio_kw, present, missing = coverage(markdown, kws)
        checks.append(Check(
            "keywords", "Job-description keyword coverage",
            15 * ratio_kw, 15,
            f"{len(present)}/{len(kws)} keywords present; missing: {', '.join(missing[:8])}",
        ))
    else:
        checks.append(Check(
            "keywords", "Job-description keyword coverage",
            3, 15,
            "no JD provided — paste a job description to score the full 15 points",
        ))

    value = round(sum(c.points for c in checks))
    return {"value": max(0, min(100, value)), "checks": [c.as_dict() for c in checks]}
