"""Editable-draft endpoint: the escape hatch that lets a user hand-fix a resume
the parser got wrong and finalize it. Honesty contract still holds — cannot
finalize with placeholder markers left in."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.auth import get_current_user
from app.main import app
from app.supa import get_supa

GOOD_MD = (
    "# Jane Doe\n"
    "jane@example.com | +91 90000 00000 | linkedin.com/in/jane\n\n"
    "## Summary\nBackend engineer with five years building payment systems.\n\n"
    "## Experience\n"
    "**Senior Engineer — Acme | 2020 - Present**\n"
    "- Shipped a billing service handling 2M transactions per day\n"
)


class FakeSupa:
    def __init__(self):
        self.updated: dict = {}

    async def select(self, table, params):
        if table == "versions":
            return [{"id": "v1", "resume_id": "r1", "structure_id": "S1",
                     "markdown": "> DRAFT\n# Old\n", "status": "draft"}]
        if table == "resumes":
            return [{"id": "r1", "parsed_json": {}}]
        return []

    async def update(self, table, params, patch):
        self.updated = patch


def client_with(fake) -> TestClient:
    app.dependency_overrides[get_current_user] = lambda: {"id": "user-1"}
    app.dependency_overrides[get_supa] = lambda: fake
    return TestClient(app)


def teardown_function():
    app.dependency_overrides.clear()


def test_save_draft_keeps_watermark_and_draft_status():
    fake = FakeSupa()
    r = client_with(fake).put(
        "/versions/v1/markdown", json={"markdown": GOOD_MD, "finalize": False}
    )
    assert r.status_code == 200
    assert r.json()["status"] == "draft"
    assert fake.updated["status"] == "draft"
    assert fake.updated["markdown"].startswith("> ")  # watermark present in draft


def test_finalize_clears_watermark_and_sets_final():
    fake = FakeSupa()
    r = client_with(fake).put(
        "/versions/v1/markdown", json={"markdown": GOOD_MD, "finalize": True}
    )
    assert r.status_code == 200
    assert r.json()["status"] == "final"
    assert "> DRAFT" not in fake.updated["markdown"]
    assert "Jane Doe" in fake.updated["markdown"]


def test_finalize_refused_with_placeholders():
    fake = FakeSupa()
    md = GOOD_MD + "- Worked at [COMPANY NAME] on [PROJECT]\n"
    r = client_with(fake).put(
        "/versions/v1/markdown", json={"markdown": md, "finalize": True}
    )
    assert r.status_code == 422
    assert "placeholder" in r.json()["detail"].lower()
    assert fake.updated == {}  # nothing stored


def test_reject_empty_or_nameless_markdown():
    fake = FakeSupa()
    r = client_with(fake).put(
        "/versions/v1/markdown",
        json={"markdown": "just some text, no name heading", "finalize": False},
    )
    assert r.status_code == 422


def test_user_submitted_watermark_line_is_stripped():
    """A user pasting back a '> DRAFT' line must not embed it into content."""
    fake = FakeSupa()
    md = "> DRAFT — leftover\n" + GOOD_MD
    r = client_with(fake).put(
        "/versions/v1/markdown", json={"markdown": md, "finalize": True}
    )
    assert r.status_code == 200
    # exactly one clean copy, no draft marker in a final
    assert "DRAFT" not in fake.updated["markdown"]
