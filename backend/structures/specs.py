"""Reference structure library: section order + rules, not visual templates.

All structures share: single column, standard headings, reverse-chronological
dates, 10-12pt system font, text-selectable PDF, no tables/graphics/icons,
one page hard limit. They differ only in section order and emphasis.
"""

STRUCTURES: dict[str, dict] = {
    "S1": {
        "name": "Classic Corporate",
        "audience": "3+ years experience — traditional, ATS-safe layout",
        "template": "classic",
        "section_order": ["contact", "summary", "skills", "experience", "education", "certifications"],
        "bullet_rules": {"max_words": 40, "verb_first": True, "min_quantified_ratio": 2 / 3},
        "density": {"experience_bullets_per_role": [2, 4], "max_skills_lines": 3},
        "length_limit_pages": 1,
    },
    "S2": {
        "name": "Jake's Resume",
        "audience": "developers — the popular LaTeX-style template",
        "template": "jake",
        "section_order": ["contact", "summary", "skills", "experience", "projects", "education"],
        "bullet_rules": {"max_words": 40, "verb_first": True, "min_quantified_ratio": 2 / 3},
        "density": {"experience_bullets_per_role": [2, 3], "projects_bullets_per_project": [2, 3], "max_skills_lines": 3},
        "length_limit_pages": 1,
    },
    "S3": {
        "name": "Modern Fresher",
        "audience": "0-2 years — friendlier layout with subtle accent",
        "template": "modern",
        "section_order": ["contact", "summary", "education", "projects_and_internships", "skills"],
        "bullet_rules": {"max_words": 40, "verb_first": True, "min_quantified_ratio": 1 / 2},
        "density": {"projects_bullets_per_project": [2, 4], "max_skills_lines": 2},
        "length_limit_pages": 1,
    },
    "S4": {
        "name": "Career Changer",
        "audience": "switching fields — skills-forward, never functional/undated",
        "template": "classic",
        "section_order": ["contact", "summary", "core_skills_expanded", "experience", "education"],
        "bullet_rules": {"max_words": 40, "verb_first": True, "min_quantified_ratio": 1 / 2},
        "density": {"experience_bullets_per_role": [2, 3], "max_skills_lines": 5},
        "length_limit_pages": 1,
    },
}


def recommend_structure(level_answer: str | None, has_projects: bool, years: int | None) -> str:
    """Deterministic structure choice from wizard signals."""
    text = (level_answer or "").lower()
    if "fresher" in text or "entry" in text or (years is not None and years <= 2):
        return "S3"
    # No dated experience at all + has projects = fresher, even if not self-labeled.
    if years is None and has_projects:
        return "S3"
    if has_projects:
        return "S2"
    return "S1"
