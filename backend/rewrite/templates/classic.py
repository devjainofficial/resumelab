"""Classic Corporate — traditional US resume template.

Signature look:
  - Name left-aligned, large sans-serif
  - Contact line left-aligned with pipe separators
  - Thick horizontal rule under contact
  - Section headings uppercase, small, light rule under
  - Entry: bold title + em-dash + company/details on ONE line
  - Dates right-aligned on the same line
  - Bullets tight, dark grey
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
@page { size: A4; margin: 14mm 16mm 14mm 16mm; }
* { box-sizing: border-box; }
body {
  font-family: 'Helvetica Neue', 'Arial', sans-serif;
  font-size: 10pt;
  line-height: 1.3;
  color: #1a1a1a;
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
  font-size: 9pt;
  font-weight: 700;
  text-align: center;
}
.name {
  font-size: 20pt;
  font-weight: 700;
  letter-spacing: 0.02em;
  margin: 0;
  color: #0a0a0a;
}
.contact {
  font-size: 9.5pt;
  color: #444;
  margin: 2pt 0 6pt 0;
  padding-bottom: 4pt;
  border-bottom: 1.5pt solid #222;
}
.section { margin-top: 8pt; }
.section-title {
  font-size: 10pt;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: #222;
  margin: 0 0 2pt 0;
  padding-bottom: 1pt;
  border-bottom: 0.6pt solid #bbb;
}
.entry { margin-top: 4pt; }
.entry-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12pt;
}
.entry-title {
  font-weight: 700;
  font-size: 10pt;
  flex: 1;
  min-width: 0;
}
.entry-title .sub {
  font-weight: 400;
  color: #444;
}
.entry-date {
  font-size: 9.5pt;
  color: #555;
  white-space: nowrap;
}
ul {
  margin: 2pt 0 0 0;
  padding-left: 15pt;
}
li {
  margin: 0 0 1pt 0;
  font-size: 9.5pt;
  line-height: 1.35;
  color: #333;
}
p.summary, p.skills {
  margin: 1pt 0 0 0;
  font-size: 9.5pt;
  line-height: 1.4;
  color: #333;
}
@media screen {
  html { background: #d6d8d7; padding: 24px; box-sizing: border-box; }
  body {
    max-width: 794px;
    margin: 0 auto;
    background: #fff;
    padding: 53px 61px;
    box-shadow: 0 2px 24px rgba(0,0,0,0.16);
  }
}
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

    left = f'<span class="entry-title">{_esc(header.title)}'
    if subs:
        left += f' <span class="sub">— {_esc(" | ".join(subs))}</span>'
    left += '</span>'
    right = f'<span class="entry-date">{_esc(date)}</span>' if date else ""

    row = f'<div class="entry-row">{left}{right}</div>'

    bullets_html = ""
    if bullets:
        items = "".join(f'<li>{_esc(b.text)}</li>' for b in bullets)
        bullets_html = f'<ul>{items}</ul>'

    return f'<div class="entry">{row}{bullets_html}</div>'


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
        if isinstance(item, list):
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
            body.append(f'<p class="summary">{_esc(item.text)}</p>')
        elif isinstance(item, Bullet):
            body.append(f'<ul><li>{_esc(item.text)}</li></ul>')

    close_section()

    return (
        "<!DOCTYPE html><html><head><meta charset='utf-8'>"
        f"<style>{CSS}</style></head><body>"
        + "".join(body)
        + "</body></html>"
    )
