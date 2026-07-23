"""Slice 4 gate: one page, parse-back passes, zero unsourced facts, DRAFT
watermark until every open input is answered."""

import re
from datetime import date
from pathlib import Path

from llm.gateway import MockGateway
from parsing.extract import extract_text_from_docx, extract_text_from_pdf, page_count_pdf
from parsing.parser import parse_resume
from rewrite.composer import DRAFT_WATERMARK, compose_markdown, polish_bullets
from rewrite.facts import source_corpus
from rewrite.renderer import render_docx, render_pdf
from wizard.gaps import detect_gaps

FIXTURES = Path(__file__).parent / "fixtures"
TODAY = date(2026, 7, 20)


def parsed_fixture(name: str) -> dict:
    return parse_resume((FIXTURES / name).read_text(encoding="utf-8"))


def answers_for_all_gaps(parsed: dict) -> list[dict]:
    """Simulate a user answering every non-MC wizard question."""
    canned = {
        "contact_email": "someone@example.com",
        "contact_phone": "+91 90000 10000",
        "contact_linkedin": "linkedin.com/in/someone",
        "target_role": "Backend developer, Python",
        "skills_list": "Git, Linux, SQL",
    }
    answers = []
    for q in detect_gaps(parsed):
        if q["kind"] == "mc":
            continue
        if q["id"].startswith("quant_"):
            value = "3"
        elif q["id"].startswith("edu_dates_"):
            value = "2021 - 2024"
        else:
            value = canned.get(q["id"], "n/a")
        answers.append({"question": f"{q['id']} :: {q['question']}", "answer": value})
    return answers


# ------------------------------------------------------------ draft/final


def test_unanswered_gaps_mean_draft_with_watermark():
    parsed = parsed_fixture("resume_sparse.txt")
    md, status, open_qs = compose_markdown(parsed, [], "S3")
    assert status == "draft"
    assert open_qs
    assert DRAFT_WATERMARK in md


def test_all_answered_means_final_without_watermark():
    parsed = parsed_fixture("resume_sparse.txt")
    answers = answers_for_all_gaps(parsed)
    md, status, open_qs = compose_markdown(parsed, answers, "S3")
    assert status == "final", [q["id"] for q in open_qs]
    assert open_qs == []
    assert DRAFT_WATERMARK not in md
    # Answered facts made it in.
    assert "+91 90000 10000" in md
    assert "linkedin.com/in/someone" in md


def test_structure_controls_section_order():
    parsed = parsed_fixture("resume_dense.txt")
    md, _, _ = compose_markdown(parsed, [], "S1")
    upper = [l for l in md.splitlines() if l.startswith("## ")]
    assert upper.index("## Summary") < upper.index("## Skills") < upper.index("## Experience")
    md3, _, _ = compose_markdown(parsed, [], "S3")
    upper3 = [l for l in md3.splitlines() if l.startswith("## ")]
    assert upper3.index("## Education") < upper3.index("## Skills")


# --------------------------------------------------------- no fabrication


def test_zero_unsourced_facts_in_markdown():
    parsed = parsed_fixture("resume_dense.txt")
    answers = answers_for_all_gaps(parsed)
    md, _, _ = compose_markdown(parsed, answers, "S1")
    corpus = source_corpus(parsed, answers) + DRAFT_WATERMARK
    structural = {"Summary", "Skills", "Experience", "Education", "Certifications",
                  "Projects", "and", "Internships"}
    # Strip markdown heading/bullet/emphasis markers before tokenizing: they
    # are formatting, not facts.
    stripped = re.sub(r"^#{1,2} |^- |^> ", "", md.replace("**", " "), flags=re.M)
    for token in re.findall(r"[A-Za-z0-9@.+/'-]+(?:#+)?", stripped):
        assert token in corpus or token in structural, f"unsourced token: {token!r}"


def test_polish_rejects_invented_numbers_and_entities():
    parsed = parsed_fixture("resume_dense.txt")
    md, _, _ = compose_markdown(parsed, [], "S1")
    target = next(l for l in md.splitlines() if l.startswith("- "))

    class LyingGateway(MockGateway):
        def _invoke_model(self, model, task, content):
            self.calls.append((model, task))
            import json
            return json.dumps({
                target: "- Increased revenue by 500% at Google",  # invented
            }), 10, 5

    out = polish_bullets(LyingGateway(), "u1", md, parsed, [], TODAY)
    assert "500%" not in out
    assert "Google" not in out
    assert out == md


def test_polish_accepts_truthful_rephrase():
    parsed = parsed_fixture("resume_dense.txt")
    md, _, _ = compose_markdown(parsed, [], "S1")
    target = next(l for l in md.splitlines() if "Built REST APIs" in l)

    class HonestGateway(MockGateway):
        def _invoke_model(self, model, task, content):
            self.calls.append((model, task))
            import json
            return json.dumps({
                target: "- Built Python REST APIs serving 40k requests per minute",
            }), 10, 5

    gw = HonestGateway()
    out = polish_bullets(gw, "u1", md, parsed, [], TODAY)
    assert "- Built Python REST APIs serving 40k requests per minute" in out
    assert gw.calls == [("gemini/gemini-2.0-flash", "rewrite")]  # flash tier for rewrites


def test_mock_gateway_leaves_markdown_unchanged():
    parsed = parsed_fixture("resume_dense.txt")
    md, _, _ = compose_markdown(parsed, [], "S1")
    assert polish_bullets(MockGateway(), "u1", md, parsed, [], TODAY) == md


# ------------------------------------------------------------- rendering


def test_pdf_is_one_page_and_parses_back():
    parsed = parsed_fixture("resume_dense.txt")
    md, _, _ = compose_markdown(parsed, answers_for_all_gaps(parsed), "S1")
    pdf = render_pdf(md)

    assert page_count_pdf(pdf) == 1

    extracted = extract_text_from_pdf(pdf)
    md_words = set(re.findall(r"[A-Za-z0-9]{3,}", md))
    pdf_words = set(re.findall(r"[A-Za-z0-9]{3,}", extracted))
    missing = md_words - pdf_words
    coverage = 1 - len(missing) / max(1, len(md_words))
    assert coverage >= 0.95, f"parse-back lost words: {sorted(missing)[:10]}"


def test_docx_renders_and_contains_content():
    parsed = parsed_fixture("resume_dense.txt")
    md, _, _ = compose_markdown(parsed, [], "S1")
    text = extract_text_from_docx(render_docx(md))
    assert "Priya Sharma" in text
    assert "FinEdge Payments" in text or "Senior Software Engineer" in text


def test_draft_pdf_omits_watermark():
    """DRAFT watermark is shown in the web preview only, never in PDF/DOCX."""
    parsed = parsed_fixture("resume_sparse.txt")
    md, status, _ = compose_markdown(parsed, [], "S3")
    assert status == "draft"
    assert "> DRAFT" in md
    extracted = extract_text_from_pdf(render_pdf(md))
    assert "DRAFT" not in extracted


def test_target_role_focus_fills_empty_summary():
    """Synthetic wizard question 'target_role_focus' fills a missing summary
    but never overrides a real one."""
    parsed = parsed_fixture("resume_sparse.txt")
    parsed["sections"]["summary"] = None
    answers = answers_for_all_gaps(parsed) + [
        {"question": "target_role_focus :: What role?",
         "answer": "Backend engineer, Python and PostgreSQL"},
    ]
    md, status, _ = compose_markdown(parsed, answers, "S1")
    assert "Backend engineer, Python and PostgreSQL" in md


def test_target_role_focus_does_not_override_real_summary():
    parsed = parsed_fixture("resume_dense.txt")
    original_summary = parsed["sections"]["summary"]
    assert original_summary  # sanity
    answers = answers_for_all_gaps(parsed) + [
        {"question": "target_role_focus :: What role?",
         "answer": "Something totally different"},
    ]
    md, _, _ = compose_markdown(parsed, answers, "S1")
    # Real summary is preserved; the sharpener does not overwrite.
    assert original_summary[:30] in md
    assert "Something totally different" not in md


def test_additional_content_appended_to_summary():
    parsed = parsed_fixture("resume_dense.txt")
    answers = answers_for_all_gaps(parsed) + [
        {"question": "additional_content :: Anything else?",
         "answer": "Recently started learning Rust and WebAssembly"},
    ]
    md, _, _ = compose_markdown(parsed, answers, "S1")
    assert "Recently started learning Rust and WebAssembly" in md
