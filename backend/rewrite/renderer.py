"""Render markdown -> PDF + DOCX. Single column, standard headings, 10-12pt
system font, text-selectable, no tables/graphics/icons.

PDF engine: WeasyPrint when its native libraries are available (CI, Docker,
production); otherwise a deterministic fpdf2 fallback with the same layout —
same markdown in, one page out, parse-back-able text either way.
"""

from __future__ import annotations

import html
import io
import re

try:  # pragma: no cover - environment probe
    from weasyprint import HTML  # type: ignore

    WEASYPRINT_AVAILABLE = True
except Exception:  # pragma: no cover
    WEASYPRINT_AVAILABLE = False

from docx import Document
from docx.shared import Pt

BOLD_RE = re.compile(r"\*\*(.+?)\*\*")


def _strip_md(line: str) -> str:
    return BOLD_RE.sub(r"\1", line)


# ------------------------------------------------------------------- PDF

_CSS = """
@page { size: A4; margin: 14mm 16mm; }
body { font-family: Helvetica, Arial, sans-serif; font-size: 10.5pt;
       line-height: 1.35; color: #111; }
h1 { font-size: 17pt; margin: 0 0 2pt 0; }
h2 { font-size: 11.5pt; text-transform: uppercase; letter-spacing: 0.04em;
     border-bottom: 0.75pt solid #999; margin: 8pt 0 3pt 0; padding-bottom: 1pt; }
p { margin: 0 0 3pt 0; }
ul { margin: 0 0 4pt 14pt; padding: 0; }
li { margin: 0 0 1.5pt 0; }
.watermark { color: #b45309; font-weight: bold; border: 1pt solid #b45309;
             padding: 3pt 6pt; margin-bottom: 6pt; }
"""


def _markdown_to_html(markdown: str) -> str:
    body: list[str] = []
    in_list = False
    for raw in markdown.splitlines():
        line = raw.rstrip()
        if line.startswith("- "):
            if not in_list:
                body.append("<ul>")
                in_list = True
            body.append(f"<li>{_inline(line[2:])}</li>")
            continue
        if in_list:
            body.append("</ul>")
            in_list = False
        if not line:
            continue
        if line.startswith("> "):
            body.append(f'<p class="watermark">{_inline(line[2:])}</p>')
        elif line.startswith("# "):
            body.append(f"<h1>{_inline(line[2:])}</h1>")
        elif line.startswith("## "):
            body.append(f"<h2>{_inline(line[3:])}</h2>")
        else:
            body.append(f"<p>{_inline(line)}</p>")
    if in_list:
        body.append("</ul>")
    return f"<html><head><style>{_CSS}</style></head><body>{''.join(body)}</body></html>"


def _inline(text: str) -> str:
    escaped = html.escape(text)
    return BOLD_RE.sub(r"<b>\1</b>", escaped)


def _render_pdf_weasyprint(markdown: str) -> bytes:  # pragma: no cover
    return HTML(string=_markdown_to_html(markdown)).write_pdf()


def _render_pdf_fpdf(markdown: str) -> bytes:
    from fpdf import FPDF
    from fpdf.enums import XPos, YPos

    pdf = FPDF(format="A4")
    pdf.set_margins(16, 14, 16)
    pdf.set_auto_page_break(auto=True, margin=14)
    pdf.add_page()

    def safe(s: str) -> str:
        return s.encode("latin-1", "replace").decode("latin-1")

    def block(text: str, height: float) -> None:
        # new_x=LMARGIN: fpdf2's default leaves the cursor at the right edge,
        # which makes the next full-width cell zero-width and crash.
        pdf.multi_cell(0, height, text, new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    for raw in markdown.splitlines():
        line = raw.rstrip()
        if not line:
            continue
        if line.startswith("> "):
            pdf.set_font("Helvetica", "B", 10)
            pdf.set_text_color(180, 83, 9)
            block(safe(_strip_md(line[2:])), 5)
            pdf.set_text_color(17, 17, 17)
        elif line.startswith("# "):
            pdf.set_font("Helvetica", "B", 17)
            block(safe(line[2:]), 8)
        elif line.startswith("## "):
            pdf.set_font("Helvetica", "B", 11.5)
            block(safe(line[3:].upper()), 6)
        elif line.startswith("- "):
            pdf.set_font("Helvetica", "", 10.5)
            block(safe("- " + _strip_md(line[2:])), 5)
        else:
            pdf.set_font("Helvetica", "", 10.5)
            block(safe(_strip_md(line)), 5)
    return bytes(pdf.output())


def render_pdf(markdown: str) -> bytes:
    if WEASYPRINT_AVAILABLE:  # pragma: no cover
        return _render_pdf_weasyprint(markdown)
    return _render_pdf_fpdf(markdown)


# ------------------------------------------------------------------ DOCX


def render_docx(markdown: str) -> bytes:
    doc = Document()
    style = doc.styles["Normal"]
    style.font.name = "Calibri"
    style.font.size = Pt(10.5)

    for raw in markdown.splitlines():
        line = raw.rstrip()
        if not line:
            continue
        if line.startswith("> "):
            p = doc.add_paragraph()
            run = p.add_run(_strip_md(line[2:]))
            run.bold = True
        elif line.startswith("# "):
            doc.add_heading(line[2:], level=0)
        elif line.startswith("## "):
            doc.add_heading(line[3:], level=1)
        elif line.startswith("- "):
            doc.add_paragraph(_strip_md(line[2:]), style="List Bullet")
        else:
            doc.add_paragraph(_strip_md(line))

    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()
