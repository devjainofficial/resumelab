"""Modern — subtle color accent, sans-serif, friendlier for early-career/fresher.

Signature look:
  - Left-aligned name with accent-color underline
  - Contact chips wrapped below name
  - Section headings with accent color, no rule
  - Entry title on its own line with role & company below in accent grey
  - Right-aligned italic dates
  - Slightly larger line-height for readability
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

ACCENT = "#1e40af"  # deep blue

CSS = f"""
@page {{ size: A4; margin: 14mm 18mm 14mm 18mm; }}
* {{ box-sizing: border-box; }}
body {{
  font-family: 'Inter', 'Helvetica Neue', Arial, sans-serif;
  font-size: 10pt;
  line-height: 1.35;
  color: #1f2937;
  margin: 0;
}}
.watermark {{
  background: #fff7ed;
  border: 1pt solid #b45309;
  color: #92400e;
  padding: 4pt 8pt;
  margin-bottom: 8pt;
  font-size: 9pt;
  font-weight: 700;
  text-align: center;
}}
.header {{
  padding-bottom: 6pt;
  border-bottom: 2pt solid {ACCENT};
  margin-bottom: 8pt;
}}
.name {{
  font-size: 22pt;
  font-weight: 700;
  letter-spacing: -0.01em;
  margin: 0;
  color: #0f172a;
}}
.contact {{
  font-size: 9.5pt;
  color: #475569;
  margin-top: 3pt;
}}
.contact span {{
  margin-right: 8pt;
}}
.section {{ margin-top: 10pt; }}
.section-title {{
  font-size: 11pt;
  font-weight: 700;
  color: {ACCENT};
  letter-spacing: 0.06em;
  text-transform: uppercase;
  margin: 0 0 3pt 0;
}}
.entry {{ margin-top: 5pt; }}
.entry-title-row {{
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 10pt;
}}
.entry-title {{
  font-weight: 600;
  font-size: 10.5pt;
  color: #0f172a;
}}
.entry-date {{
  font-size: 9.5pt;
  color: #64748b;
  font-style: italic;
  white-space: nowrap;
}}
.entry-sub {{
  font-size: 9.5pt;
  color: #475569;
  margin-top: 1pt;
}}
ul {{
  margin: 3pt 0 0 0;
  padding-left: 14pt;
}}
li {{
  margin: 0 0 1.5pt 0;
  font-size: 9.5pt;
  line-height: 1.4;
  color: #334155;
}}
p.summary, p.skills {{
  margin: 1pt 0 0 0;
  font-size: 9.5pt;
  color: #334155;
  line-height: 1.5;
}}
"""


def _esc(s: str) -> str:
    return html.escape(s)


def _looks_like_date(s: str) -> bool:
    low = s.lower()
    if "present" in low or "current" in low:
        return True
    if any(m in low for m in ["jan", "feb", "mar", "apr", "may", "jun",
                               "jul", "aug", "sep", "oct", "nov", "dec"]):
        return True
    return any(len(tok) == 4 and tok.isdigit() for tok in low.replace("-", " ").split())


def _entry_html(header: EntryHeader, bullets: list[Bullet]) -> str:
    details = list(header.details)
    date = ""
    subs: list[str] = []
    for d in details:
        if not date and _looks_like_date(d):
            date = d
        else:
            subs.append(d)

    left = f'<span class="entry-title">{_esc(header.title)}</span>'
    right = f'<span class="entry-date">{_esc(date)}</span>' if date else ""
    row1 = f'<div class="entry-title-row">{left}{right}</div>'

    row2 = ""
    if subs:
        row2 = f'<div class="entry-sub">{_esc(" · ".join(subs))}</div>'

    bullets_html = ""
    if bullets:
        items = "".join(f'<li>{_esc(b.text)}</li>' for b in bullets)
        bullets_html = f'<ul>{items}</ul>'

    return f'<div class="entry">{row1}{row2}{bullets_html}</div>'


def render(markdown: str, watermark: bool = False) -> str:
    blocks = parse_blocks(markdown)
    grouped = group_entries(blocks)

    body: list[str] = []
    header_open = False
    in_section = False

    def close_section():
        nonlocal in_section
        if in_section:
            body.append("</div>")
            in_section = False

    def close_header():
        nonlocal header_open
        if header_open:
            body.append("</div>")
            header_open = False

    for item in grouped:
        if isinstance(item, list):
            body.append(_entry_html(item[0], item[1:]))
        elif isinstance(item, Watermark):
            if watermark:
                body.append(f'<div class="watermark">{_esc(item.text)}</div>')
        elif isinstance(item, Name):
            close_section()
            close_header()
            body.append('<div class="header">')
            header_open = True
            body.append(f'<h1 class="name">{_esc(item.text)}</h1>')
        elif isinstance(item, Contact):
            chips = "".join(f"<span>{_esc(p)}</span>" for p in item.parts)
            body.append(f'<div class="contact">{chips}</div>')
        elif isinstance(item, SectionHeading):
            close_header()
            close_section()
            body.append('<div class="section">')
            in_section = True
            body.append(
                f'<div class="section-title">{_esc(item.text)}</div>'
            )
        elif isinstance(item, Paragraph):
            body.append(f'<p class="summary">{_esc(item.text)}</p>')
        elif isinstance(item, Bullet):
            body.append(f'<ul><li>{_esc(item.text)}</li></ul>')

    close_section()
    close_header()

    return (
        "<!DOCTYPE html><html><head><meta charset='utf-8'>"
        f"<style>{CSS}</style></head><body>"
        + "".join(body)
        + "</body></html>"
    )
