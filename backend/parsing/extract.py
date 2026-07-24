"""Deterministic text extraction from uploaded files. Zero LLM tokens.

Real-world resume PDFs (Canva, LaTeX, online builders) extract badly with the
default pypdf mode: words glued together, the name fused to the contact line,
"T " ligature artifacts, and decorative middots (U+00B7) standing in for spaces.
We use pypdf's layout mode (preserves reading order and word spacing) and then
normalize the common corruption patterns before parsing.
"""

from __future__ import annotations

import io
import re

from docx import Document
from pypdf import PdfReader


class UnsupportedFileType(Exception):
    pass


def extract_text(filename: str, data: bytes) -> str:
    lower = filename.lower()
    if lower.endswith(".pdf"):
        return extract_text_from_pdf(data)
    if lower.endswith(".docx"):
        return extract_text_from_docx(data)
    raise UnsupportedFileType(f"unsupported file type: {filename}")


# Bullet-like glyphs that should become list markers. Deliberately excludes the
# degree sign (U+00B0) and other chars that appear inside real prose ("360°
# feedback", "37°C") — converting those would shred legitimate content.
_BULLET_GLYPHS = "•●▪‣⁃∙◦■❖♦"
_BULLET_RE = re.compile(rf"\s*[{_BULLET_GLYPHS}]\s*")


def normalize_pdf_text(text: str) -> str:
    """Repair the common PDF-extraction corruption patterns.

    - Middot (U+00B7) used as a space-substitute: replaced with a space, but
      only when pervasive (>=10 occurrences), so genuine "A · B" separators in
      a normal resume are left alone.
    - Bullet glyphs -> a newline plus "- " so each point is its own line.
    - Runs of spaces (layout-mode alignment padding) collapsed to one.
    - Trailing whitespace and 3+ blank lines trimmed.
    """
    if not text:
        return ""

    # 1. Middot-as-space corruption (only when clearly pervasive).
    if text.count("·") >= 10:
        text = re.sub(r"\s*·\s*", " ", text)

    # 2. Real bullet glyphs -> line-leading markers.
    text = _BULLET_RE.sub("\n- ", text)

    # 3. Trim extreme alignment padding but KEEP a 2-space gap: the skills
    #    parser uses a "{2,} spaces" delimiter to recover column-laid-out skills
    #    that have no commas. Collapsing all runs to one space would erase that
    #    signal. HTML rendering collapses the double space, so output is clean.
    lines = [re.sub(r"[ \t]{3,}", "  ", ln).strip() for ln in text.split("\n")]
    text = "\n".join(lines)

    # 4. Collapse 3+ newlines to a blank-line separator.
    text = re.sub(r"\n{3,}", "\n\n", text)

    return text.strip()


def extract_text_from_pdf(data: bytes) -> str:
    """Extract text using layout mode (best word-spacing fidelity), falling
    back to plain mode if layout extraction fails, then normalize."""
    reader = PdfReader(io.BytesIO(data))
    pages: list[str] = []
    for page in reader.pages:
        try:
            txt = page.extract_text(extraction_mode="layout") or ""
        except Exception:
            txt = page.extract_text() or ""
        pages.append(txt)
    raw = "\n".join(pages)
    return normalize_pdf_text(raw)


def extract_text_from_docx(data: bytes) -> str:
    doc = Document(io.BytesIO(data))
    parts: list[str] = [p.text for p in doc.paragraphs]
    for table in doc.tables:
        for row in table.rows:
            parts.append("\t".join(cell.text for cell in row.cells))
    return "\n".join(parts)


def page_count_pdf(data: bytes) -> int:
    return len(PdfReader(io.BytesIO(data)).pages)
