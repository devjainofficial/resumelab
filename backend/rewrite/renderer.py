"""Render markdown -> PDF + DOCX. Professional single-column layout using the
reference structure templates: standard headings, 10-12pt font, one page,
text-selectable, no tables/graphics/icons.

PDF engine: WeasyPrint when its native libraries are available (CI, Docker,
production); otherwise a deterministic fpdf2 fallback.
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
from docx.shared import Pt, Inches, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH

BOLD_RE = re.compile(r"\*\*(.+?)\*\*")


def _strip_md(line: str) -> str:
    return BOLD_RE.sub(r"\1", line)


# ------------------------------------------------------------------- PDF

_CSS = """
@page {
  size: A4;
  margin: 12mm 14mm 12mm 14mm;
}
body {
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  font-size: 10pt;
  line-height: 1.3;
  color: #1a1a1a;
  margin: 0;
  padding: 0;
}
h1 {
  font-size: 18pt;
  font-weight: 700;
  margin: 0 0 1pt 0;
  color: #0a0a0a;
  letter-spacing: 0.02em;
}
.contact {
  font-size: 9pt;
  color: #555;
  margin: 0 0 6pt 0;
  padding-bottom: 6pt;
  border-bottom: 1.5pt solid #222;
}
h2 {
  font-size: 10pt;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #222;
  margin: 8pt 0 3pt 0;
  padding-bottom: 1.5pt;
  border-bottom: 0.5pt solid #ccc;
}
.entry-header {
  font-size: 10pt;
  margin: 4pt 0 1pt 0;
  line-height: 1.25;
}
.entry-header b {
  font-weight: 700;
}
.entry-header .right {
  float: right;
  font-weight: 400;
  font-size: 9pt;
  color: #555;
}
p {
  margin: 0 0 2pt 0;
  font-size: 10pt;
}
.summary {
  font-size: 9.5pt;
  color: #333;
  margin: 0 0 2pt 0;
  line-height: 1.35;
}
.skills {
  font-size: 9.5pt;
  color: #333;
  margin: 0 0 2pt 0;
  line-height: 1.35;
}
ul {
  margin: 0 0 2pt 13pt;
  padding: 0;
}
li {
  font-size: 9.5pt;
  margin: 0 0 1pt 0;
  line-height: 1.3;
  color: #222;
}
.watermark {
  color: #b45309;
  font-weight: bold;
  border: 1pt solid #b45309;
  padding: 3pt 6pt;
  margin-bottom: 6pt;
  font-size: 9pt;
}
"""


def _strip_watermark(markdown: str) -> str:
    return "\n".join(
        l for l in markdown.splitlines() if not l.startswith("> DRAFT")
    )


def _markdown_to_html(markdown: str) -> str:
    body: list[str] = []
    in_list = False
    prev_was_h1 = False

    for raw in _strip_watermark(markdown).splitlines():
        line = raw.rstrip()

        if line.startswith("- "):
            if not in_list:
                body.append("<ul>")
                in_list = True
            body.append(f"<li>{_inline(line[2:])}</li>")
            prev_was_h1 = False
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
            prev_was_h1 = True
            continue
        elif line.startswith("## "):
            section = line[3:].strip()
            body.append(f"<h2>{html.escape(section)}</h2>")
        elif prev_was_h1 and "|" in line:
            body.append(
                f'<p class="contact">{_inline(line)}</p>'
            )
        elif line.startswith("**"):
            body.append(f'<p class="entry-header">{_inline(line)}</p>')
        elif any(
            line.lower().startswith(w)
            for w in ("summary", "skills", "core")
        ):
            body.append(f'<p class="skills">{_inline(line)}</p>')
        else:
            is_after_heading = len(body) > 0 and any(
                body[-1].startswith(t) for t in ("<h2", '<p class="contact"')
            )
            cls = "summary" if is_after_heading else ""
            if cls:
                body.append(f'<p class="{cls}">{_inline(line)}</p>')
            else:
                body.append(f"<p>{_inline(line)}</p>")

        prev_was_h1 = False

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
    pdf.set_margins(14, 12, 14)
    pdf.set_auto_page_break(auto=True, margin=12)
    pdf.add_page()

    def safe(s: str) -> str:
        return s.encode("latin-1", "replace").decode("latin-1")

    def block(text: str, height: float) -> None:
        pdf.multi_cell(0, height, text, new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    prev_was_name = False
    for raw in _strip_watermark(markdown).splitlines():
        line = raw.rstrip()
        if not line:
            continue
        if line.startswith("# "):
            pdf.set_font("Helvetica", "B", 18)
            pdf.set_text_color(10, 10, 10)
            block(safe(line[2:]), 8)
            prev_was_name = True
            continue
        elif line.startswith("## "):
            pdf.ln(2)
            pdf.set_font("Helvetica", "B", 10)
            pdf.set_text_color(34, 34, 34)
            heading = safe(line[3:].upper())
            block(heading, 5)
            # draw underline
            y = pdf.get_y()
            pdf.set_draw_color(200, 200, 200)
            pdf.line(14, y, 196, y)
            pdf.ln(1.5)
        elif prev_was_name and "|" in line:
            pdf.set_font("Helvetica", "", 9)
            pdf.set_text_color(85, 85, 85)
            block(safe(_strip_md(line)), 4)
            # thick divider after contact
            y = pdf.get_y() + 1
            pdf.set_draw_color(34, 34, 34)
            pdf.set_line_width(0.5)
            pdf.line(14, y, 196, y)
            pdf.set_line_width(0.2)
            pdf.ln(3)
        elif line.startswith("**"):
            pdf.ln(1)
            pdf.set_font("Helvetica", "B", 10)
            pdf.set_text_color(26, 26, 26)
            block(safe(_strip_md(line)), 4.5)
        elif line.startswith("- "):
            pdf.set_font("Helvetica", "", 9.5)
            pdf.set_text_color(34, 34, 34)
            text = safe(_strip_md(line[2:]))
            pdf.cell(4, 4.5, "-", new_x=XPos.RIGHT, new_y=YPos.TOP)
            pdf.multi_cell(0, 4.5, text, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        else:
            pdf.set_font("Helvetica", "", 9.5)
            pdf.set_text_color(51, 51, 51)
            block(safe(_strip_md(line)), 4.5)
        prev_was_name = False

    return bytes(pdf.output())


def render_pdf(markdown: str) -> bytes:
    if WEASYPRINT_AVAILABLE:  # pragma: no cover
        return _render_pdf_weasyprint(markdown)
    return _render_pdf_fpdf(markdown)


# ------------------------------------------------------------------ DOCX


def render_docx(markdown: str) -> bytes:
    doc = Document()

    # Set narrow margins
    for section in doc.sections:
        section.top_margin = Inches(0.5)
        section.bottom_margin = Inches(0.5)
        section.left_margin = Inches(0.6)
        section.right_margin = Inches(0.6)

    style = doc.styles["Normal"]
    style.font.name = "Calibri"
    style.font.size = Pt(10)
    style.font.color.rgb = RGBColor(0x1A, 0x1A, 0x1A)
    style.paragraph_format.space_after = Pt(1)
    style.paragraph_format.space_before = Pt(0)

    prev_was_name = False
    for raw in _strip_watermark(markdown).splitlines():
        line = raw.rstrip()
        if not line:
            continue
        if line.startswith("# "):
            p = doc.add_paragraph()
            p.alignment = WD_ALIGN_PARAGRAPH.LEFT
            run = p.add_run(line[2:])
            run.bold = True
            run.font.size = Pt(18)
            run.font.color.rgb = RGBColor(0x0A, 0x0A, 0x0A)
            p.paragraph_format.space_after = Pt(0)
            prev_was_name = True
            continue
        elif line.startswith("## "):
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(6)
            p.paragraph_format.space_after = Pt(2)
            run = p.add_run(line[3:].upper())
            run.bold = True
            run.font.size = Pt(10)
            run.font.color.rgb = RGBColor(0x22, 0x22, 0x22)
            # Add bottom border via paragraph format
            from docx.oxml.ns import qn
            pPr = p._element.get_or_add_pPr()
            pBdr = pPr.makeelement(qn("w:pBdr"), {})
            bottom = pBdr.makeelement(
                qn("w:bottom"),
                {
                    qn("w:val"): "single",
                    qn("w:sz"): "4",
                    qn("w:space"): "1",
                    qn("w:color"): "CCCCCC",
                },
            )
            pBdr.append(bottom)
            pPr.append(pBdr)
        elif prev_was_name and "|" in line:
            p = doc.add_paragraph()
            run = p.add_run(_strip_md(line))
            run.font.size = Pt(9)
            run.font.color.rgb = RGBColor(0x55, 0x55, 0x55)
            p.paragraph_format.space_after = Pt(4)
        elif line.startswith("**"):
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(3)
            p.paragraph_format.space_after = Pt(1)
            cleaned = _strip_md(line)
            parts = cleaned.split(" — ", 1)
            run = p.add_run(parts[0])
            run.bold = True
            run.font.size = Pt(10)
            if len(parts) > 1:
                run2 = p.add_run(f" — {parts[1]}")
                run2.font.size = Pt(9)
                run2.font.color.rgb = RGBColor(0x55, 0x55, 0x55)
        elif line.startswith("- "):
            p = doc.add_paragraph(_strip_md(line[2:]), style="List Bullet")
            p.paragraph_format.space_after = Pt(0.5)
            for run in p.runs:
                run.font.size = Pt(9.5)
                run.font.color.rgb = RGBColor(0x22, 0x22, 0x22)
        else:
            p = doc.add_paragraph()
            run = p.add_run(_strip_md(line))
            run.font.size = Pt(9.5)
            run.font.color.rgb = RGBColor(0x33, 0x33, 0x33)
        prev_was_name = False

    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()
