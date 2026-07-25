"""Deterministic text extraction from uploaded files. Zero LLM tokens.

PDF extraction strategy (most-to-least robust):
  1. PyMuPDF (fitz) — handles ligature ToUnicode tables correctly; the right
     choice for 95%+ of real-world resumes (Canva, LaTeX, Word, online builders).
  2. pypdf layout mode — fallback when fitz is unavailable or fails.
  3. pypdf plain mode — last resort if layout mode throws.

After extraction a normalization pass repairs common corruption patterns.
A second pass catches pypdf-specific ligature artifacts (the "/" proxy for
"ti"/"fi" ligatures, and sequences of individually-positioned glyph chars)
so the parser always receives clean prose regardless of extractor used.
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


# ---------------------------------------------------------------------------
# General normalisation (runs after any extractor)
# ---------------------------------------------------------------------------

_BULLET_GLYPHS = "•●▪‣⁃∙◦■❖♦"
_BULLET_RE = re.compile(rf"\s*[{_BULLET_GLYPHS}]\s*")


def normalize_pdf_text(text: str) -> str:
    """Repair common PDF-extraction corruption patterns.

    - Middot (U+00B7) used as a space-substitute: replaced with a space, but
      only when pervasive (>=10 occurrences), so genuine "A · B" separators in
      a normal resume are left alone.
    - Bullet glyphs -> newline + "- " so each point is its own line.
    - Extreme alignment padding collapsed; 2-space gap preserved so the skills
      parser can use it as a column delimiter.
    - 3+ blank lines collapsed to a single blank line.
    """
    if not text:
        return ""

    if text.count("·") >= 10:
        text = re.sub(r"\s*·\s*", " ", text)

    text = _BULLET_RE.sub("\n- ", text)

    lines = [re.sub(r"[ \t]{3,}", "  ", ln).strip() for ln in text.split("\n")]
    text = "\n".join(lines)

    text = re.sub(r"\n{3,}", "\n\n", text)

    return text.strip()


# ---------------------------------------------------------------------------
# pypdf-specific ligature / encoding artifact repair
# ---------------------------------------------------------------------------

# Some PDF fonts encode "ti" / "fi" / "ffi" ligatures with a ToUnicode entry
# that pypdf resolves to "/" instead of the correct letters.  Manifests as:
#   "applica / ons"   ->  "applications"
#   "automa / on"     ->  "automation"
#   "qualifica / on"  ->  "qualification"
#   "iden / fy"       ->  "identify"
# Heuristic: both flanking fragments must be 3+ lowercase-only chars so real
# slash separators ("C# / Python", "REST / SOAP", "Jan / Feb") are untouched.
_LIGATURE_SLASH_RE = re.compile(r"([a-z]{3,})\s/\s([a-z]{3,})")


def _fix_ligature_slash(text: str) -> str:
    return _LIGATURE_SLASH_RE.sub(lambda m: m.group(1) + m.group(2), text)


# pypdf sometimes extracts character-positioned text as individually spaced
# glyphs: "T, e, c, h, n, o, l, o, g, i, e, s" instead of "Technologies".
# We collapse sequences of 4+ comma-space-separated 1-2 char tokens.
# The 4-item minimum avoids false triggers on real comma-separated items.
_SCATTERED_CHARS_RE = re.compile(
    r"(?<!\w)([A-Za-z]{1,2}(?:,\s[A-Za-z]{1,2}){3,})(?!\w)"
)


def _fix_scattered_chars(text: str) -> str:
    return _SCATTERED_CHARS_RE.sub(lambda m: m.group(0).replace(", ", ""), text)


def _repair_pypdf_artifacts(text: str) -> str:
    text = _fix_ligature_slash(text)
    text = _fix_scattered_chars(text)
    return text


# ---------------------------------------------------------------------------
# Extractor implementations
# ---------------------------------------------------------------------------

def _extract_fitz(data: bytes) -> str | None:
    """Primary extractor: PyMuPDF.  Handles ligature ToUnicode correctly.
    Returns None if fitz is not installed or the document can't be read."""
    try:
        import fitz  # pymupdf
    except ImportError:
        return None
    try:
        doc = fitz.open(stream=data, filetype="pdf")
        pages = [page.get_text("text") for page in doc]
        doc.close()
        raw = "\n".join(pages).replace("\x0c", "\n")  # strip form-feeds
        return raw if raw.strip() else None
    except Exception:
        return None


def _extract_pypdf(data: bytes) -> str:
    """Fallback extractor: pypdf layout mode, plain mode per page on error."""
    reader = PdfReader(io.BytesIO(data))
    pages: list[str] = []
    for page in reader.pages:
        try:
            txt = page.extract_text(extraction_mode="layout") or ""
        except Exception:
            txt = page.extract_text() or ""
        pages.append(txt)
    raw = "\n".join(pages)
    # Apply pypdf-specific artifact repair before general normalisation.
    return _repair_pypdf_artifacts(raw)


def extract_text_from_pdf(data: bytes) -> str:
    """Extract and normalise text from a PDF.

    Tries PyMuPDF first (correct ligature handling); falls back to pypdf.
    Both paths pass through the same normalization layer.
    """
    raw = _extract_fitz(data)
    if raw is None:
        raw = _extract_pypdf(data)
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
