"""Deterministic text extraction from uploaded files. Zero LLM tokens."""

from __future__ import annotations

import io

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


def extract_text_from_pdf(data: bytes) -> str:
    reader = PdfReader(io.BytesIO(data))
    pages = [page.extract_text() or "" for page in reader.pages]
    return "\n".join(pages)


def extract_text_from_docx(data: bytes) -> str:
    doc = Document(io.BytesIO(data))
    parts: list[str] = [p.text for p in doc.paragraphs]
    for table in doc.tables:
        for row in table.rows:
            parts.append("\t".join(cell.text for cell in row.cells))
    return "\n".join(parts)


def page_count_pdf(data: bytes) -> int:
    return len(PdfReader(io.BytesIO(data)).pages)
