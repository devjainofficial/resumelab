"""Jake's Resume — the ATS-classic LaTeX template, rendered in HTML/CSS.

Reference: https://github.com/jakegut/resume
Signature look:
  - Centered name in Latin Modern Roman (we use Charter/Georgia fallback)
  - Contact line centered with pipe separators, one horizontal rule below
  - Section headings uppercase, left-aligned, thin rule under
  - Two-column entry headers: title bold left, dates italic right
  - Second row: role/company left, location right (italic)
  - Tight bullet list with round dots
"""

from __future__ import annotations

import html

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

CSS = """
@page { size: Letter; margin: 0.5in 0.5in 0.5in 0.5in; }
* { box-sizing: border-box; }
body {
  font-family: 'Charter', 'Georgia', 'Times New Roman', serif;
  font-size: 10.5pt;
  line-height: 1.25;
  color: #000;
  margin: 0;
  overflow-wrap: break-word;
  word-break: break-word;
}
.watermark {
  background: #fff7ed;
  border: 1pt solid #b45309;
  color: #92400e;
  padding: 4pt 8pt;
  margin-bottom: 8pt;
  font-family: 'Helvetica', sans-serif;
  font-size: 9pt;
  font-weight: 700;
  text-align: center;
}
.name {
  text-align: center;
  font-size: 24pt;
  font-weight: 700;
  letter-spacing: 0.02em;
  margin: 0;
  line-height: 1.05;
}
.contact {
  text-align: center;
  font-size: 10pt;
  margin: 4pt 0 4pt 0;
}
.contact a { color: #000; text-decoration: none; }
.rule-top {
  border-top: 0.6pt solid #000;
  margin-top: 2pt;
}
.section {
  margin-top: 8pt;
}
.section-title {
  font-size: 11.5pt;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  margin: 0 0 1pt 0;
  padding-bottom: 1pt;
  border-bottom: 0.6pt solid #000;
}
.entry {
  margin-top: 4pt;
}
.entry-row {
  display: flex;
  justify-content: space-between;
  gap: 12pt;
  align-items: baseline;
}
.entry-title { font-weight: 700; font-size: 10.5pt; flex: 1; min-width: 0; }
.entry-date { font-style: italic; font-size: 10pt; white-space: nowrap; }
.entry-sub { font-style: italic; font-size: 10pt; }
.entry-loc { font-style: italic; font-size: 10pt; white-space: nowrap; }
ul {
  margin: 2pt 0 0 0;
  padding-left: 14pt;
}
li {
  margin: 0 0 1pt 0;
  font-size: 10pt;
  line-height: 1.3;
}
p.summary, p.skills {
  margin: 2pt 0 0 0;
  font-size: 10pt;
  line-height: 1.3;
}
p.skills b { font-weight: 700; }
@media screen {
  html { background: #d6d8d7; padding: 24px; box-sizing: border-box; }
  body {
    max-width: 794px;
    margin: 0 auto;
    background: #fff;
    padding: 48px 48px;
    box-shadow: 0 2px 24px rgba(0,0,0,0.16);
  }
}
"""


def _esc(s: str) -> str:
    return html.escape(s)


def _entry_html(header: EntryHeader, bullets: list[Bullet]) -> str:
    # Jake's split: title left, last detail (usually date) right on row 1
    # subtitle left, location right on row 2
    details = list(header.details)
    date = ""
    location = ""
    subtitle = ""

    # Heuristic: dates contain year digits or month names or "present"
    def looks_like_date(s: str) -> bool:
        s_low = s.lower()
        if "present" in s_low or "current" in s_low:
            return True
        if any(m in s_low for m in ["jan", "feb", "mar", "apr", "may", "jun",
                                     "jul", "aug", "sep", "oct", "nov", "dec"]):
            return True
        # 4-digit year
        return any(len(tok) == 4 and tok.isdigit() for tok in s.replace("-", " ").split())

    for d in details:
        if not date and looks_like_date(d):
            date = d
        elif not subtitle:
            subtitle = d
        elif not location:
            location = d

    row1 = (
        f'<div class="entry-row">'
        f'<span class="entry-title">{_esc(header.title)}</span>'
        f'<span class="entry-date">{_esc(date)}</span>'
        f'</div>'
    )
    row2 = ""
    if subtitle or location:
        row2 = (
            f'<div class="entry-row">'
            f'<span class="entry-sub">{_esc(subtitle)}</span>'
            f'<span class="entry-loc">{_esc(location)}</span>'
            f'</div>'
        )

    bullets_html = ""
    if bullets:
        items = "".join(f'<li>{_esc(b.text)}</li>' for b in bullets)
        bullets_html = f'<ul>{items}</ul>'

    return f'<div class="entry">{row1}{row2}{bullets_html}</div>'


def render(markdown: str, watermark: bool = False) -> str:
    blocks = parse_blocks(markdown)
    grouped = group_entries(blocks)

    body: list[str] = []
    in_section = False

    def close_section():
        nonlocal in_section
        if in_section:
            body.append("</div>")
            in_section = False

    for item in grouped:
        if isinstance(item, list):  # entry group
            body.append(_entry_html(item[0], item[1:]))
        elif isinstance(item, Watermark):
            if watermark:
                body.append(f'<div class="watermark">{_esc(item.text)}</div>')
        elif isinstance(item, Name):
            close_section()
            body.append(f'<h1 class="name">{_esc(item.text)}</h1>')
        elif isinstance(item, Contact):
            body.append(
                f'<div class="contact">{_esc(" | ".join(item.parts))}</div>'
            )
        elif isinstance(item, SectionHeading):
            close_section()
            body.append('<div class="section">')
            in_section = True
            body.append(
                f'<div class="section-title">{_esc(item.text)}</div>'
            )
        elif isinstance(item, Paragraph):
            # Sits under Summary/Skills — plain paragraph
            body.append(f'<p class="summary">{_esc(item.text)}</p>')
        elif isinstance(item, Bullet):
            # Free-standing bullet (rare; certifications section)
            body.append(f'<ul><li>{_esc(item.text)}</li></ul>')

    close_section()

    return (
        "<!DOCTYPE html><html><head><meta charset='utf-8'>"
        f"<style>{CSS}</style></head><body>"
        + "".join(body)
        + "</body></html>"
    )
