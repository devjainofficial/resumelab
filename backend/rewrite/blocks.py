"""Parse composed markdown into typed resume blocks.

The composer's markdown is regular and controlled. We parse it into blocks
so per-template renderers can lay them out however they like — Jake's
two-column entry headers, Classic left-aligned, Modern with color, etc.

Every template consumes the SAME blocks, so content stays consistent
across templates and downloads never diverge from the preview.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Literal

BOLD_RE = re.compile(r"\*\*(.+?)\*\*")


@dataclass
class Watermark:
    text: str


@dataclass
class Name:
    text: str


@dataclass
class Contact:
    """The pipe-separated contact line right after the name."""
    parts: list[str]


@dataclass
class SectionHeading:
    text: str


@dataclass
class EntryHeader:
    """Bold title + optional " — subtitle | subtitle | date"."""
    title: str
    details: list[str] = field(default_factory=list)  # everything after the em-dash


@dataclass
class Bullet:
    text: str


@dataclass
class Paragraph:
    """Free text under a heading — summary body, skills line, etc."""
    text: str


Block = Watermark | Name | Contact | SectionHeading | EntryHeader | Bullet | Paragraph


def _strip_bold(text: str) -> str:
    return BOLD_RE.sub(r"\1", text)


def parse_blocks(markdown: str) -> list[Block]:
    """Convert composer markdown into an ordered list of typed blocks."""
    blocks: list[Block] = []
    prev_was_name = False

    for raw in markdown.splitlines():
        line = raw.rstrip()
        if not line:
            prev_was_name = False
            continue

        if line.startswith("> "):
            blocks.append(Watermark(_strip_bold(line[2:])))
            prev_was_name = False
        elif line.startswith("# "):
            blocks.append(Name(line[2:].strip()))
            prev_was_name = True
        elif prev_was_name and "|" in line:
            parts = [p.strip() for p in _strip_bold(line).split("|") if p.strip()]
            blocks.append(Contact(parts))
            prev_was_name = False
        elif line.startswith("## "):
            blocks.append(SectionHeading(line[3:].strip()))
            prev_was_name = False
        elif line.startswith("- "):
            blocks.append(Bullet(_strip_bold(line[2:])))
            prev_was_name = False
        elif line.startswith("**"):
            cleaned = _strip_bold(line)
            if " — " in cleaned:
                title, rest = cleaned.split(" — ", 1)
                details = [p.strip() for p in rest.split("|") if p.strip()]
            else:
                title, details = cleaned, []
            blocks.append(EntryHeader(title.strip(), details))
            prev_was_name = False
        else:
            blocks.append(Paragraph(_strip_bold(line)))
            prev_was_name = False

    return blocks


def group_entries(blocks: list[Block]) -> list[Block | list[Block]]:
    """Group each EntryHeader with its following Bullet lines so templates
    can render each entry as a unit (2-col header + bullets)."""
    out: list[Block | list[Block]] = []
    i = 0
    while i < len(blocks):
        b = blocks[i]
        if isinstance(b, EntryHeader):
            group: list[Block] = [b]
            j = i + 1
            while j < len(blocks) and isinstance(blocks[j], Bullet):
                group.append(blocks[j])
                j += 1
            out.append(group)
            i = j
        else:
            out.append(b)
            i += 1
    return out
