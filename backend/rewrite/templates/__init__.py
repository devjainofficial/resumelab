"""Per-template resume renderers.

Each template consumes typed `Block`s from `rewrite.blocks` and produces
HTML (with inline CSS) suitable for both browser preview and WeasyPrint
PDF generation. The same HTML string powers both, so the download
never looks different from the preview.
"""

from __future__ import annotations

from rewrite.templates import classic, jake, modern

TEMPLATES = {
    "jake": jake,
    "classic": classic,
    "modern": modern,
}


def render_html(template_key: str, markdown: str, watermark: bool = False) -> str:
    """Return a complete HTML document for the given template."""
    tpl = TEMPLATES.get(template_key, TEMPLATES["classic"])
    return tpl.render(markdown, watermark=watermark)
