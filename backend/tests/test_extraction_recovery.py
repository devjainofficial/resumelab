"""Regression guard for real-world PDF extraction corruption.

`garbled_layout_raw.txt` is the verbatim pypdf layout-mode extraction of a real
resume whose font encodes spaces as middots (U+00B7) and bullets as U+2022. The
naive pipeline produced: name=None, email with the surname glued on, zero
experience entries, scrambled skills. These tests lock in the recovery.
"""

from __future__ import annotations

from pathlib import Path

from parsing.extract import normalize_pdf_text
from parsing.parser import parse_resume

FIXTURES = Path(__file__).parent / "fixtures"
RAW = (FIXTURES / "garbled_layout_raw.txt").read_text(encoding="utf-8")


def test_normalization_removes_middot_space_substitute():
    out = normalize_pdf_text(RAW)
    # Middots were used as spaces — they must be gone, words rejoined.
    assert "·" not in out
    assert "Architected the server-side" in out
    assert "e-commerce" in out  # soft-hyphen wrap rejoined


def test_normalization_converts_bullets_to_markers():
    out = normalize_pdf_text(RAW)
    assert "•" not in out
    # Each real bullet becomes a line-leading "- ".
    assert "- Architected the server-side services" in out
    assert "- Designed 20+ REST API endpoints" in out


def test_normalization_leaves_occasional_middot_alone():
    """A resume that uses a couple of real middots as separators must NOT be
    mangled — only the pervasive-corruption case triggers replacement."""
    text = "React · Redux · Node"  # 2 middots, below the threshold
    assert normalize_pdf_text(text) == "React · Redux · Node"


def test_parse_recovers_contact_from_garbled_pdf():
    parsed = parse_resume(normalize_pdf_text(RAW))
    assert parsed["contact"]["name"] == "SAMPLE CANDIDATE"
    assert parsed["contact"]["email"] == "sample.candidate@example.com"
    assert parsed["contact"]["phone"] is not None
    assert "linkedin.com/in/samplecandidate" in (
        parsed["contact"]["linkedin"] or ""
    )


def test_parse_recovers_summary_and_bullets():
    parsed = parse_resume(normalize_pdf_text(RAW))
    assert parsed["sections"]["summary"]
    assert "Full-stack developer" in parsed["sections"]["summary"]
    # Bullets recovered across projects (was 0 usable before).
    all_bullets = [
        b for e in parsed["sections"]["projects"] for b in e["bullets"]
    ]
    assert len(all_bullets) >= 8
    assert any("Reduced API response times" in b for b in all_bullets)


def test_parse_no_fake_entries_from_wrapped_bullets():
    """The 'e-commerce' wrap must not spawn a 'commerce platform...' entry."""
    parsed = parse_resume(normalize_pdf_text(RAW))
    headers = [
        e["header"][0] if e["header"] else ""
        for e in parsed["sections"]["projects"]
    ]
    assert not any(h.startswith("commerce platform") for h in headers)
