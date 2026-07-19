"""Slice 2 gate: parse fidelity on 3 known resumes, across txt, PDF and DOCX
input paths. Every asserted value must come verbatim from the fixture."""

import io
from pathlib import Path

from parsing.extract import extract_text_from_docx, extract_text_from_pdf
from parsing.parser import parse_resume

FIXTURES = Path(__file__).parent / "fixtures"


def load(name: str) -> str:
    return (FIXTURES / name).read_text(encoding="utf-8")


# ---------------------------------------------------------------- fidelity


def test_dense_resume_fidelity():
    p = parse_resume(load("resume_dense.txt"))
    assert p["contact"]["name"] == "Priya Sharma"
    assert p["contact"]["email"] == "priya.sharma@example.com"
    assert p["contact"]["phone"] is not None
    assert p["contact"]["linkedin"] == "linkedin.com/in/priyasharma"
    assert p["contact"]["github"] == "github.com/priyasharma"
    assert "payment systems" in p["sections"]["summary"]
    assert "Python" in p["sections"]["skills"]
    assert "Kafka" in p["sections"]["skills"]
    exp = p["sections"]["experience"]
    assert len(exp) == 2
    assert any("FinEdge Payments" in h for h in exp[0]["header"])
    assert exp[0]["dates"] is not None
    assert len(exp[0]["bullets"]) == 3
    assert exp[0]["bullets"][0].startswith("Led migration")
    assert len(exp[1]["bullets"]) == 2
    edu = p["sections"]["education"]
    assert any("NIT Trichy" in h for e in edu for h in e["header"])
    assert len(p["sections"]["certifications"]) == 2
    assert p["flags"]["has_placeholders"] is False


def test_projects_resume_fidelity():
    p = parse_resume(load("resume_projects.txt"))
    assert p["contact"]["name"] == "Arjun Mehta"
    assert p["contact"]["email"] == "arjun.mehta@example.com"
    assert p["contact"]["github"] == "github.com/arjunm"
    assert "side projects" in p["sections"]["summary"]
    assert "TypeScript" in p["sections"]["skills"]
    projects = p["sections"]["projects"]
    assert len(projects) == 2
    assert any("DevDeck" in h for h in projects[0]["header"])
    assert any("3k monthly users" in b for b in projects[0]["bullets"])
    assert len(p["sections"]["experience"]) == 1


def test_sparse_resume_fidelity():
    p = parse_resume(load("resume_sparse.txt"))
    assert p["contact"]["name"] == "Rahul V"
    assert p["contact"]["email"] == "rahul.v@example.com"
    assert p["contact"]["phone"] is None
    assert p["contact"]["linkedin"] is None
    assert p["sections"]["skills"] == ["Java", "HTML"]
    exp = p["sections"]["experience"]
    assert len(exp) == 1
    assert exp[0]["bullets"] == ["Helped with website"]
    # sparse-ness is visible downstream: few bullets, thin summary
    assert p["stats"]["bullet_count"] == 1


# ------------------------------------------------- pdf/docx extraction paths


def _fixture_as_pdf(text: str) -> bytes:
    from fpdf import FPDF

    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Helvetica", size=10)
    for line in text.splitlines():
        # latin-1-safe: replace bullets for the PDF writer, parser accepts '-'
        pdf.cell(0, 5, line.replace("•", "-").encode("latin-1", "replace").decode("latin-1"), ln=True)
    return bytes(pdf.output())


def _fixture_as_docx(text: str) -> bytes:
    from docx import Document

    doc = Document()
    for line in text.splitlines():
        doc.add_paragraph(line)
    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()


def test_pdf_roundtrip_preserves_structure():
    text = load("resume_dense.txt")
    extracted = extract_text_from_pdf(_fixture_as_pdf(text))
    p = parse_resume(extracted)
    assert p["contact"]["email"] == "priya.sharma@example.com"
    assert len(p["sections"]["experience"]) == 2
    assert len(p["sections"]["experience"][0]["bullets"]) == 3


def test_docx_roundtrip_preserves_structure():
    text = load("resume_dense.txt")
    extracted = extract_text_from_docx(_fixture_as_docx(text))
    p = parse_resume(extracted)
    assert p["contact"]["email"] == "priya.sharma@example.com"
    assert len(p["sections"]["experience"]) == 2
    assert p["sections"]["experience"][0]["bullets"][0].startswith("Led migration")


def test_parser_never_invents_content():
    """No-fabrication contract at the parser level: every parsed string is a
    substring of the source text."""
    text = load("resume_dense.txt")
    p = parse_resume(text)

    def all_strings(obj):
        if isinstance(obj, str):
            yield obj
        elif isinstance(obj, dict):
            for v in obj.values():
                yield from all_strings(v)
        elif isinstance(obj, list):
            for v in obj:
                yield from all_strings(v)

    for s in all_strings({"contact": p["contact"], "sections": p["sections"]}):
        for piece in s.split():
            assert piece in text, f"invented token: {piece!r}"
