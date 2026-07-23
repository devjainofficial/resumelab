"""Template renderers: same markdown, three different visual templates."""

from __future__ import annotations

from rewrite.blocks import (
    Bullet,
    Contact,
    EntryHeader,
    Name,
    Paragraph,
    SectionHeading,
    Watermark,
    group_entries,
    parse_blocks,
)
from rewrite.renderer import render_preview_html
from rewrite.templates import render_html


SAMPLE_MD = """> DRAFT — some prompt

# Dev Jain
dev@example.com | +91 1234 | linkedin.com/in/dev

## Summary
Software developer with 3 years of full-stack experience.

## Skills
React, TypeScript, Node.js, PostgreSQL

## Experience
**Software Developer** — Zobi Web Solution | Ahmedabad | January 2024 to Present
- Built HR management system in .NET Core MVC
- Increased performance by 30%

**Web Developer Intern** — A2 Creations | Remote | April 2023 to December 2023
- Adapted quickly to changing deadlines

## Education
**B.Tech Computer Science** — Sample University | 2019 to 2023
"""


def test_parse_blocks_recognizes_types():
    blocks = parse_blocks(SAMPLE_MD)
    kinds = [type(b).__name__ for b in blocks]
    assert "Watermark" in kinds
    assert "Name" in kinds
    assert "Contact" in kinds
    assert "SectionHeading" in kinds
    assert "EntryHeader" in kinds
    assert "Bullet" in kinds


def test_parse_blocks_contact_split():
    blocks = parse_blocks("# Jane\na@b.co | +1 555 | linkedin.com/in/jane\n")
    contacts = [b for b in blocks if isinstance(b, Contact)]
    assert len(contacts) == 1
    assert contacts[0].parts == ["a@b.co", "+1 555", "linkedin.com/in/jane"]


def test_parse_blocks_entry_header_details():
    blocks = parse_blocks("**Software Developer** — Zobi | Ahmedabad | 2024 to Present\n- x\n")
    headers = [b for b in blocks if isinstance(b, EntryHeader)]
    assert headers[0].title == "Software Developer"
    assert "Zobi" in headers[0].details
    assert "Ahmedabad" in headers[0].details
    assert "2024 to Present" in headers[0].details


def test_group_entries_bundles_bullets():
    blocks = parse_blocks("**Role** — Co | 2024\n- a\n- b\n**Role2**\n- c\n")
    grouped = group_entries(blocks)
    entry_groups = [g for g in grouped if isinstance(g, list)]
    assert len(entry_groups) == 2
    assert len(entry_groups[0]) == 3  # header + 2 bullets
    assert len(entry_groups[1]) == 2  # header + 1 bullet


def test_all_templates_render_valid_html():
    for template in ("jake", "classic", "modern"):
        html = render_html(template, SAMPLE_MD, watermark=False)
        assert html.startswith("<!DOCTYPE html>")
        assert "Dev Jain" in html
        assert "Zobi Web Solution" in html
        assert "Built HR management system" in html
        # Watermark stripped when watermark=False
        assert "DRAFT" not in html


def test_watermark_shown_only_when_requested():
    html_no = render_html("classic", SAMPLE_MD, watermark=False)
    html_yes = render_html("classic", SAMPLE_MD, watermark=True)
    assert "DRAFT" not in html_no
    assert "DRAFT" in html_yes


def test_render_preview_html_uses_structure_template():
    """S2 -> Jake's; S1 -> classic. Different CSS should be present."""
    jake = render_preview_html(SAMPLE_MD, "S2")
    classic = render_preview_html(SAMPLE_MD, "S1")
    # Jake's uses Charter serif; classic uses Helvetica sans
    assert "Charter" in jake
    assert "Helvetica" in classic


def test_preview_html_shows_draft_watermark():
    """Preview always shows the draft watermark when the markdown has one."""
    html = render_preview_html(SAMPLE_MD, "S1")
    assert "DRAFT" in html


def test_unknown_template_falls_back_to_classic():
    html = render_html("nonexistent-template", SAMPLE_MD, watermark=False)
    assert "Helvetica" in html  # classic's font stack


def test_jake_template_has_two_column_entry_layout():
    """Jake's signature: entry title left, date right on same row."""
    html = render_html("jake", SAMPLE_MD, watermark=False)
    assert "entry-title" in html
    assert "entry-date" in html
    assert "flex" in html  # rows use flexbox for justify-between


def test_templates_escape_html_in_content():
    """Content from user input must not inject HTML into the rendered page."""
    md = "# <script>alert(1)</script>\na@b.co\n"
    html = render_html("classic", md, watermark=False)
    assert "<script>alert" not in html
    assert "&lt;script&gt;" in html
