"""Built-in ATS scorer: deterministic, free, 0-100 with a readable per-check
breakdown. DRAFTs cannot be scored.

Calibration philosophy: match the harshness of tools like Resume Worded so
users don't see a wildly generous internal score. Structural checks (does it
parse, is it one page, is contact info present) earn baseline points but
cannot on their own push a weak resume to 80+. Real quality comes from
achievement-oriented, quantified bullets in confident language.

Scoring model — four criterion groups (100 pts, 85 attainable without a JD):
  Impact   (27): quantified bullets, verb quality, verb variety
  Language (22): confident phrasing, no buzzwords, bullet length, variety
  Depth    (19): substance, PDF fidelity, no placeholders
  Structure(17): page count (context-aware), contact, headings
  Job match(15): keyword coverage when JD provided (0 baseline without JD)
"""

from __future__ import annotations

import re
from collections import Counter
from dataclasses import dataclass

from parsing.extract import extract_text_from_pdf, page_count_pdf
from parsing.parser import PLACEHOLDER_RE
from rewrite.renderer import render_pdf
from scoring.keywords import coverage, extract_keywords

# Extended set of ATS-recognised section headings. Includes common extras
# (Publications, Languages, Certifications) so a resume with legitimate
# additional sections is not penalised — only truly unusual headings
# ("My Journey", "What I Bring") are flagged.
ATS_RECOGNIZED_HEADINGS: frozenset[str] = frozenset({
    # Summary / objective variants
    "summary", "professional summary", "career summary", "executive summary",
    "objective", "career objective", "profile", "professional profile",
    "about", "about me", "overview", "introduction",
    # Experience variants
    "experience", "work experience", "professional experience", "employment",
    "employment history", "work history", "career history", "career experience",
    # Skills variants
    "skills", "technical skills", "core skills", "key skills",
    "competencies", "core competencies", "expertise", "technologies",
    "technical expertise",
    # Education variants
    "education", "educational background", "academic background",
    "qualifications", "academic qualifications",
    # Projects variants
    "projects", "personal projects", "side projects", "open source",
    "projects and internships", "open-source projects",
    # Legitimate extras that ATS systems recognise
    "certifications", "certifications and licenses", "licenses",
    "awards", "awards and honors", "honors", "achievements",
    "publications", "research", "presentations", "conferences",
    "volunteer", "volunteering", "volunteer experience", "community",
    "languages", "language skills",
    "interests", "hobbies", "activities",
    "references",
    "internships", "internship experience",
    "leadership", "leadership experience",
    "training", "professional development",
    "patents",
})

# Keep the old name as an alias so any external callers don't break.
STANDARD_HEADINGS = ATS_RECOGNIZED_HEADINGS

ACTION_VERB_HINTS = {
    "led", "built", "created", "designed", "developed", "implemented",
    "launched", "managed", "improved", "reduced", "increased", "shipped",
    "migrated", "automated", "optimized", "delivered", "owned", "drove",
    "cut", "grew", "scaled", "introduced", "refactored", "maintained",
    "architected", "mentored", "established", "streamlined",
    "wrote", "tested", "deployed", "integrated", "analyzed", "won",
    "spearheaded", "orchestrated", "engineered", "pioneered", "transformed",
    "accelerated", "generated", "trained", "coached", "negotiated",
    "revamped", "expanded", "executed", "initiated", "identified",
    "formulated", "oversaw", "programmed", "resolved", "upgraded",
    "converted", "consolidated", "simplified", "secured", "released",
    "rebuilt", "proposed", "restructured", "evaluated", "enforced",
    "enabled", "debugged", "configured", "audited", "directed",
    "coordinated", "presented", "published", "defined",
}

WEAK_PHRASES = [
    "responsible for", "in charge of", "duties included", "duties were",
    "tasked with", "worked on", "worked with", "worked as",
    "helped with", "helped to", "assisted with", "assisted in",
    "involved in", "participated in", "contributed to", "engaged in",
    "part of the team that", "member of a team", "team that",
    "gained experience", "exposure to", "familiar with", "knowledge of",
    "handled", "dealt with", "supported the",
]

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

_REPEAT_EXCLUSIONS: frozenset[str] = frozenset({
    "sql server", "rest api", "rest apis", "api calls", "api endpoints",
    "machine learning", "deep learning", "neural network", "neural networks",
    "natural language", "large language",
    "software engineer", "software engineering", "software development",
    "full stack", "end to end", "cross functional",
    "version control", "code review", "code reviews",
    "pull request", "pull requests", "unit tests", "unit testing",
    "continuous integration", "continuous deployment", "ci cd",
    "object oriented", "data structures", "algorithms and data",
    "product manager", "project manager", "software architect",
    "developed and maintained", "designed and developed", "built and deployed",
})

_N = r"[\d,]+(?:\.\d+)?"
_UNIT_ALTS = (
    "k|m|b|mn|bn|million|billion|thousand|hundred"
    "|user|customer|client|person|people|member|hire|candidate"
    "|engineer|developer|employee|analyst|designer|manager"
    "|request|call|query|transaction|order|event|record|item"
    "|release|deploy|deployment|sprint|iteration|version"
    "|hour|day|week|month|year|quarter"
    "|ticket|issue|bug|feature|project|repo|service|endpoint|api"
    "|country|region|office|team|account|lead|deal"
    "|line|commit|pr|review|test|case"
    "|page|screen|component|module"
    "|interview|report|dashboard|product"
)

IMPACT_SIGNALS = [
    rf"{_N}\s*\+?\s*%",
    rf"{_N}[xX]\b",
    rf"\$\s*{_N}(?:\s*[kmbt]|\s*(?:million|billion|thousand))?",
    rf"₹\s*{_N}(?:\s*(?:l|lakh|cr|crore|k|m))?",
    rf"{_N}\s*\+?\s*(?:{_UNIT_ALTS})s?\b",
    rf"{_N}\s*\+?\s*\w+\s+(?:{_UNIT_ALTS})s?\b",
    rf"\b{_N}\+",
    rf"\bby\s+{_N}",
    rf"\bto\s+{_N}",
    rf"\bfrom\s+{_N}.*?\bto\s+{_N}",
    r"\bresulting in\b", r"\bleading to\b", r"\bwhich (?:led|resulted)\b",
    r"\bsaved\b", r"\bearned\b",
    r"\bincreased\b.*\bby\b", r"\breduced\b.*\bby\b",
    r"\bimproved\b.*\bby\b", r"\bcut\b.*\bby\b",
    r"\bgrew\b.*\b(?:by|to)\b", r"\bscaled\b.*\bto\b",
]
_IMPACT_RE = re.compile("|".join(IMPACT_SIGNALS), re.IGNORECASE)

# Criterion grouping: (id, label, [check_ids in priority order])
# Actionable tip shown per finding in the UI — one plain-English sentence each.
FINDING_TIPS: dict[str, str] = {
    "achievement": "Add team sizes, percentages, dollar amounts, or latency numbers to weak bullets",
    "verb_first": "Start each bullet with an action verb: Led, Built, Reduced, Scaled, Shipped",
    "verb_variety": "Use different verbs across bullets — Led, Delivered, Reduced, Scaled, Designed",
    "weak_language": "Replace 'Responsible for' and 'Worked on' with direct action verbs",
    "buzzwords": "Remove clichés: 'team player', 'passionate', 'dynamic', 'results-driven'",
    "bullet_length": "Trim bullets over 40 words — one achievement per line",
    "start_variety": "Mix how bullets begin; too many starting the same way hurts readability",
    "depth": "Aim for 4–6 bullets per role, a 15+ word summary, and 6+ skills listed",
    "parse_back": "Use a plain-text PDF with no tables, text boxes, or embedded images",
    "placeholders": "Remove all [PLACEHOLDER] markers before your final download",
    "one_page": "Trim to one page — cut oldest roles or condense skill lists",
    "contact": "Add email, phone, and linkedin.com/in/yourname to your header",
    "headings": "Use standard section names ATS systems recognise: Experience, Skills, Education",
    "keywords": "Paste a job description above to see which keywords your resume is missing",
}

CRITERIA_GROUPS = [
    ("impact",    "Impact",    ["achievement", "verb_first", "verb_variety"]),
    ("language",  "Language",  ["weak_language", "buzzwords", "bullet_length", "start_variety"]),
    ("depth",     "Depth",     ["depth", "parse_back", "placeholders"]),
    ("structure", "Structure", ["one_page", "contact", "headings"]),
    ("keywords",  "Job match", ["keywords"]),
]

_CURRENT_YEAR = 2026


@dataclass
class Check:
    id: str
    label: str
    points: float
    max_points: float
    detail: str
    section: str = "document"
    criterion: str = "depth"

    def as_dict(self) -> dict:
        d: dict = {
            "id": self.id,
            "label": self.label,
            "points": round(self.points, 1),
            "max_points": self.max_points,
            "detail": self.detail,
            "section": self.section,
            "criterion": self.criterion,
        }
        tip = FINDING_TIPS.get(self.id)
        if tip and self.points < self.max_points:
            d["tip"] = tip
        return d


def _detect_sections(markdown: str) -> dict[str, str]:
    """Map canonical role → first matching heading name found in this resume.

    Handles non-standard headings: 'Work History' maps to 'experience',
    'Side Projects' maps to 'projects', etc. Unknown headings are left as-is
    so the scorer can still find experience bullets under any name.
    """
    ROLE_KEYWORDS: dict[str, tuple[str, ...]] = {
        "experience": ("experience", "work", "career", "employment", "professional history"),
        "projects": ("project", "portfolio", "open source", "open-source"),
        "skills": ("skill", "competenc", "technolog", "expertise"),
        "summary": ("summary", "profile", "objective", "about", "overview"),
        "education": ("education", "degree", "academic", "university", "college", "qualification"),
    }
    sections: dict[str, str] = {}
    for line in markdown.splitlines():
        if line.startswith("## "):
            h = line[3:].strip()
            h_low = h.lower()
            for role, keywords in ROLE_KEYWORDS.items():
                if role not in sections and any(kw in h_low for kw in keywords):
                    sections[role] = h
    return sections


def _detect_experience_years(markdown: str) -> float:
    """Estimate years of professional experience from the date-range span.

    Scans for four-digit years (1990-2029). If 'Present'/'Current'/'Now'
    appears anywhere, uses the current year as the end date. Returns 0 when
    no years are found.
    """
    year_re = re.compile(r"\b(20\d{2}|19\d{2})\b")
    present_re = re.compile(r"\b(?:present|current|now)\b", re.IGNORECASE)
    years = [int(y) for y in year_re.findall(markdown)]
    if not years:
        return 0.0
    max_year = _CURRENT_YEAR if present_re.search(markdown) else max(years)
    return max(0.0, float(max_year - min(years)))


def _bullets(markdown: str) -> list[str]:
    return [l[2:].strip() for l in markdown.splitlines() if l.startswith("- ")]


def _experience_bullets(markdown: str) -> list[str]:
    """Return bullets from experience-class sections.

    Uses _detect_sections to resolve the actual heading names so resumes with
    'Work History', 'Professional Experience', or custom names still score
    correctly.
    """
    detected = _detect_sections(markdown)
    exp_headings = {
        detected.get("experience", "experience").lower(),
        detected.get("projects", "projects").lower(),
        "projects and internships",
    }
    out: list[str] = []
    section: str | None = None
    for line in markdown.splitlines():
        if line.startswith("## "):
            section = line[3:].strip().lower()
        elif line.startswith("- ") and section in exp_headings:
            out.append(line[2:].strip())
    return out


def _verb_first(bullet: str) -> bool:
    first = re.split(r"\W+", bullet.strip(), 1)[0].lower()
    return first in ACTION_VERB_HINTS


def _count_weak_phrases(text: str) -> tuple[int, list[str]]:
    text_low = " " + text.lower() + " "
    found: list[str] = []
    for phrase in WEAK_PHRASES:
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


def _count_phrase_repetition(bullets: list[str]) -> tuple[int, list[str]]:
    """Count trigrams that appear 3+ times across bullets, excluding tech terms."""
    if len(bullets) < 4:
        return 0, []
    trigrams: Counter[str] = Counter()
    for b in bullets:
        words = re.findall(r"[a-z]+", b.lower())
        for i in range(len(words) - 2):
            phrase = f"{words[i]} {words[i + 1]} {words[i + 2]}"
            if phrase not in _REPEAT_EXCLUSIONS:
                trigrams[phrase] += 1
    repeated = sorted(
        ((ph, cnt) for ph, cnt in trigrams.items() if cnt >= 3),
        key=lambda x: -x[1],
    )
    return len(repeated), [f"'{ph}' ({cnt}×)" for ph, cnt in repeated[:3]]


def score_resume(
    markdown: str, jd_text: str | None = None, structure_id: str = "S1"
) -> dict:
    """Score a FINAL markdown. Returns {value, checks, criteria}. Deterministic:
    same input -> same score, zero LLM tokens.

    `checks` is a flat list (backward-compatible with existing callers).
    `criteria` groups those checks into Impact / Language / Depth / Structure /
    Job match for display purposes.
    """
    checks: list[Check] = []
    pdf = render_pdf(markdown, structure_id)
    pdf_text = extract_text_from_pdf(pdf)
    bullets = _bullets(markdown)
    exp_bullets = _experience_bullets(markdown)
    detected_sections = _detect_sections(markdown)
    exp_section_name = detected_sections.get("experience", "Experience")
    exp_years = _detect_experience_years(markdown)

    # --- Structural (must-pass) — 25 total ------------------------------
    # 1. Parse-back fidelity (8)
    md_words = set(re.findall(r"[A-Za-z0-9]{3,}", markdown))
    pdf_words = set(re.findall(r"[A-Za-z0-9]{3,}", pdf_text))
    ratio = 1 - len(md_words - pdf_words) / max(1, len(md_words))
    checks.append(Check(
        "parse_back", "Text survives PDF rendering", 8 * min(1.0, ratio / 0.95), 8,
        f"{ratio:.0%} of source words recovered from the rendered PDF",
        section="document", criterion="depth",
    ))

    # 2. Page count — experience-aware (6)
    pages = page_count_pdf(pdf)
    if pages == 1:
        page_pts, page_detail = 6.0, "1 page"
    elif pages == 2:
        if exp_years >= 7:
            page_pts = 6.0
            page_detail = f"2 pages — appropriate for ~{exp_years:.0f} years of experience"
        elif exp_years >= 4:
            page_pts = 4.0
            page_detail = "2 pages — aim for 1 page at this experience level"
        else:
            page_pts = 1.0
            page_detail = "2 pages — aim for 1 page for early-career roles"
    else:
        page_pts, page_detail = 0.0, f"{pages} pages — trim to 1-2 pages"
    checks.append(Check("one_page", "Page count for experience level", page_pts, 6, page_detail,
                         section="document", criterion="structure"))

    # 3. ATS-recognised section headings (3)
    headings_low = [l[3:].strip().lower() for l in markdown.splitlines() if l.startswith("## ")]
    nonstandard = [h for h in headings_low if h not in ATS_RECOGNIZED_HEADINGS]
    if not headings_low:
        head_pts, head_detail = 0.0, "no section headings found"
    elif not nonstandard:
        head_pts, head_detail = 3.0, "all headings ATS-recognised"
    elif len(nonstandard) == 1:
        head_pts = 2.0
        head_detail = f"advisory: '{nonstandard[0]}' may not be parsed by all ATS systems"
    else:
        head_pts = 0.0
        head_detail = f"unrecognised headings: {nonstandard}"
    checks.append(Check("headings", "ATS-recognised section headings", head_pts, 3, head_detail,
                         section="document", criterion="structure"))

    # 4. Contact completeness (8)
    head = "\n".join(markdown.splitlines()[:6])
    has_email = bool(re.search(r"[\w.+-]+@[\w-]+\.[\w.]+", head))
    has_phone = bool(re.search(r"(?:\+\d{1,3}[ -]?)?(?:\d[ -]?){9,12}\d", head))
    has_linkedin = "linkedin" in head.lower()
    got = sum([has_email, has_phone, has_linkedin])
    checks.append(Check(
        "contact", "Contact info complete (email, phone, LinkedIn)",
        got * (8 / 3), 8,
        f"email={has_email}, phone={has_phone}, linkedin={has_linkedin}",
        section="header", criterion="structure",
    ))

    # --- Bullet quality — 40 total --------------------------------------
    # 5. Verb-first (7)
    if bullets:
        vf_ratio = sum(_verb_first(b) for b in bullets) / len(bullets)
        checks.append(Check(
            "verb_first", "Bullets start with strong action verbs", 7 * vf_ratio, 7,
            f"{vf_ratio:.0%} verb-first",
            section="bullets", criterion="impact",
        ))
    else:
        checks.append(Check("verb_first", "Bullets start with strong action verbs", 0, 7,
                             "no bullets found", section="bullets", criterion="impact"))

    # 6. Bullet length — 8 to 40 words (3)
    if bullets:
        too_long = [b for b in bullets if len(b.split()) > 40]
        too_short = [b for b in bullets if len(b.split()) < 8]
        if too_long:
            bl_pts = 0.0
            bl_detail = f"{len(too_long)} bullet(s) exceed 40 words"
        elif too_short:
            thin_ratio = len(too_short) / len(bullets)
            bl_pts = max(0.0, 3.0 - thin_ratio * 3.0)
            bl_detail = f"{len(too_short)} thin bullet(s) under 8 words"
        else:
            bl_pts = 3.0
            bl_detail = "all bullets 8-40 words"
        checks.append(Check("bullet_length", "Bullets 8-40 words (not thin, not bloated)",
                             bl_pts, 3, bl_detail, section="bullets", criterion="language"))
    else:
        checks.append(Check("bullet_length", "Bullets 8-40 words (not thin, not bloated)",
                             0, 3, "no bullets found", section="bullets", criterion="language"))

    # 7. Verb variety (5)
    if bullets:
        firsts = [re.split(r"\W+", b, 1)[0].lower() for b in bullets]
        repeats = len(firsts) - len(set(firsts))
        variety = max(0.0, 1 - repeats / max(1, len(firsts)))
        checks.append(Check(
            "verb_variety", "Opening verbs vary", 5 * variety, 5,
            f"{len(set(firsts))} distinct verbs across {len(firsts)} bullets",
            section="bullets", criterion="impact",
        ))
    else:
        checks.append(Check("verb_variety", "Opening verbs vary", 0, 5,
                             "no bullets found", section="bullets", criterion="impact"))

    # 8. Weak-verb / passive phrases (10 penalty-based)
    weak_count, weak_examples = _count_weak_phrases(markdown)
    weak_pts = max(0.0, 10 - weak_count * 3.5)
    checks.append(Check(
        "weak_language", "Confident language (no 'responsible for', 'worked on')",
        weak_pts, 10,
        "clean" if not weak_count
        else f"{weak_count} weak phrase(s): {', '.join(weak_examples)}",
        section="bullets", criterion="language",
    ))

    # 9. Achievement-oriented bullets (15)
    if exp_bullets:
        impact_ratio = sum(_has_impact_signal(b) for b in exp_bullets) / len(exp_bullets)
        pts = 15 * min(1.0, impact_ratio / 0.9)
        checks.append(Check(
            "achievement", "Bullets show measurable impact (numbers, %, results)",
            pts, 15,
            f"{impact_ratio:.0%} of experience bullets show a result or metric",
            section=exp_section_name, criterion="impact",
        ))
    else:
        checks.append(Check("achievement", "Bullets show measurable impact", 0, 15,
                             "no experience bullets",
                             section=exp_section_name, criterion="impact"))

    # --- Content quality — 20 total -------------------------------------
    # 10. Buzzwords / clichés (6 penalty-based)
    buzz_count, buzz_examples = _count_buzzwords(markdown)
    buzz_pts = max(0.0, 6 - buzz_count * 2.0)
    checks.append(Check(
        "buzzwords", "No overused buzzwords or personality traits",
        buzz_pts, 6,
        "clean" if not buzz_count
        else f"{buzz_count} buzzword(s): {', '.join(buzz_examples)}",
        section="all sections", criterion="language",
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
    skill_names: list[str] = []
    for i, line in enumerate(lines):
        if line.strip().lower() == "## skills":
            j = i + 1
            while j < len(lines) and not lines[j].strip().startswith("##"):
                raw = lines[j]
                if raw.strip():
                    raw = raw.split(":", 1)[1] if ":" in raw else raw
                    skill_names.extend(s.strip() for s in raw.split(",") if s.strip())
                j += 1
            break
    skills_terms = len(skill_names)
    depth_skills = 2.0 if skills_terms >= 8 else (1.0 if skills_terms >= 5 else 0.0)
    exp_lower = " ".join(exp_bullets).lower()
    unevidenced = [s for s in skill_names if s.lower() not in exp_lower]
    skills_note = (
        f"; {len(unevidenced)} skill(s) not in bullets: {', '.join(unevidenced[:3])}"
        if unevidenced else ""
    )
    checks.append(Check(
        "depth", "Enough substance (bullets, summary, skills)",
        depth_bullets + depth_summary + depth_skills, 8,
        f"{len(exp_bullets)} bullets (target 6+), "
        f"summary {len(summary_line.split())}w, {skills_terms} skills{skills_note}",
        section="experience, summary, skills", criterion="depth",
    ))

    # 12. No placeholders (3)
    placeholders = PLACEHOLDER_RE.findall(markdown)
    real_placeholders = [p for p in placeholders if p != "(skipped)"]
    checks.append(Check(
        "placeholders", "No placeholder markers", 3.0 if not real_placeholders else 0.0, 3,
        "clean" if not real_placeholders else f"found: {real_placeholders[:5]}",
        section="document", criterion="depth",
    ))

    # 13. Sentence-start variety + phrase repetition (3)
    if len(bullets) >= 4:
        firsts = [b.split()[0].lower() if b.split() else "" for b in bullets]
        most_common_first = max(set(firsts), key=firsts.count)
        most_common_count = firsts.count(most_common_first)
        overuse_ratio = most_common_count / len(bullets)
        variety_pts = 3.0 if overuse_ratio <= 0.3 else max(0.0, 3.0 * (1 - (overuse_ratio - 0.3) * 3))
        rep_count, rep_examples = _count_phrase_repetition(bullets)
        phrase_penalty = min(variety_pts, rep_count * 0.5)
        final_pts = max(0.0, variety_pts - phrase_penalty)
        detail_parts: list[str] = [f"'{most_common_first}' starts {overuse_ratio:.0%} of bullets"]
        if rep_examples:
            detail_parts.append(f"repeated: {', '.join(rep_examples)}")
        checks.append(Check(
            "start_variety", "No overused opening words or repeated phrases",
            final_pts, 3,
            "; ".join(detail_parts),
            section="bullets", criterion="language",
        ))
    else:
        checks.append(Check("start_variety", "No overused opening words or repeated phrases",
                             3, 3, "too few bullets to score",
                             section="bullets", criterion="language"))

    # --- JD keyword coverage — 15 (or 0 baseline without JD) ------------
    if jd_text:
        kws = extract_keywords(jd_text)
        ratio_kw, present, missing = coverage(markdown, kws)
        checks.append(Check(
            "keywords", "Job-description keyword coverage",
            15 * ratio_kw, 15,
            f"{len(present)}/{len(kws)} keywords present; missing: {', '.join(missing[:8])}",
            section="all sections", criterion="keywords",
        ))
    else:
        checks.append(Check(
            "keywords", "Job-description keyword coverage",
            0, 15,
            "no JD provided — add one to unlock the full 15 points",
            section="all sections", criterion="keywords",
        ))

    # --- Group into criteria -------------------------------------------
    checks_dicts = [c.as_dict() for c in checks]
    by_id = {c["id"]: c for c in checks_dicts}
    criteria = []
    for crit_id, crit_label, check_ids in CRITERIA_GROUPS:
        findings = [by_id[cid] for cid in check_ids if cid in by_id]
        if not findings:
            continue
        crit_score = round(sum(f["points"] for f in findings), 1)
        crit_max = sum(f["max_points"] for f in findings)
        criteria.append({
            "id": crit_id,
            "label": crit_label,
            "score": crit_score,
            "max": crit_max,
            "findings": findings,
        })

    value = round(sum(c.points for c in checks))
    return {
        "value": max(0, min(100, value)),
        "checks": checks_dicts,
        "criteria": criteria,
    }
