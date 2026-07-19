"""Slice 6 gate: findings map to targeted patches only; a finding needing a
number produces a question, not a number; screenshots parse into structured
findings; before/after scores are reported."""

import json
from datetime import date
from pathlib import Path

from fastapi.testclient import TestClient

from app.auth import get_current_user
from app.gateway_dep import get_app_gateway
from app.main import app
from app.supa import get_supa
from llm.gateway import MockGateway
from parsing.parser import parse_resume
from repair.findings import findings_from_screenshot, parse_text_findings
from repair.patcher import apply_repairs
from rewrite.composer import compose_markdown
from tests.test_compose import answers_for_all_gaps

FIXTURES = Path(__file__).parent / "fixtures"
TODAY = date(2026, 7, 20)

RESUME_WORDED_TEXT = """
Overall score: 61
Quantify impact: 6 bullet points lack numbers
Buzzwords: 8 overused phrases found
Repetition: the same verb starts 4 bullets
Personal pronouns: found 2 uses of "I"
Some unrelated praise line that matches nothing
"""


def final_dense() -> tuple[str, dict, list]:
    parsed = parse_resume((FIXTURES / "resume_dense.txt").read_text(encoding="utf-8"))
    answers = answers_for_all_gaps(parsed)
    md, status, _ = compose_markdown(parsed, answers, "S1")
    assert status == "final"
    return md, parsed, answers


# --------------------------------------------------------- text findings


def test_text_findings_parse_to_structured_categories():
    findings = parse_text_findings(RESUME_WORDED_TEXT)
    cats = {f["category"]: f for f in findings}
    assert set(cats) == {"quantify", "buzzwords", "verb_repetition", "pronouns"}
    assert cats["quantify"]["count"] == 6
    assert cats["buzzwords"]["count"] == 8
    # Unclassifiable lines are ignored, not guessed at.
    assert all(f["category"] for f in findings)


# ------------------------------------------------------------- patching


def test_buzzword_finding_deletes_deterministically_and_touches_nothing_else():
    md, parsed, answers = final_dense()
    md_with_buzz = md.replace(
        "- Built REST APIs in Python serving 40k requests per minute",
        "- Results-driven team player passionate about building REST APIs in Python serving 40k requests per minute",
    )
    out = apply_repairs(
        md_with_buzz, [{"category": "buzzwords", "count": 3, "source_line": "x"}],
        parsed, answers, MockGateway(), "u1", TODAY,
    )
    assert "Results-driven" not in out["markdown"]
    assert "team player" not in out["markdown"]
    assert "passionate" not in out["markdown"]
    assert "REST APIs in Python serving 40k requests per minute" in out["markdown"]
    assert any("buzzword" in a.lower() for a in out["actions"])
    # Targeted: every line without buzzwords is byte-identical.
    before_lines = md_with_buzz.splitlines()
    after_lines = out["markdown"].splitlines()
    assert len(before_lines) == len(after_lines)
    changed = [i for i, (a, b) in enumerate(zip(before_lines, after_lines)) if a != b]
    assert len(changed) == 1  # only the offending bullet


def test_quantify_finding_produces_questions_never_numbers():
    md, parsed, answers = final_dense()
    # Strip the numbers from one bullet so a quantification gap exists.
    md_gap = md.replace(
        "- Introduced contract testing, cutting integration failures by 60%",
        "- Introduced contract testing across services",
    )
    out = apply_repairs(
        md_gap, [{"category": "quantify", "count": 1, "source_line": "x"}],
        parsed, answers, MockGateway(), "u1", TODAY,
    )
    assert out["new_questions"], "expected a wizard question for the number gap"
    q = out["new_questions"][0]
    assert q["kind"] == "number"
    assert "Introduced contract testing across services" in q["question"]
    # THE core rule: the markdown gained no digits it didn't have.
    assert out["markdown"] == md_gap
    assert any("nothing was invented" in a for a in out["actions"])


def test_verb_repetition_rewrite_is_truth_checked():
    md, parsed, answers = final_dense()
    md_rep = md.replace(
        "- Reduced infrastructure cost by 23% by right-sizing Kubernetes workloads",
        "- Led cost reduction of 23% by right-sizing Kubernetes workloads",
    )  # now two bullets start with "Led"
    target = "- Led cost reduction of 23% by right-sizing Kubernetes workloads"

    class LyingGateway(MockGateway):
        def _invoke_model(self, model, task, content):
            self.calls.append((model, task))
            return json.dumps({target: "- Slashed cloud spend 90% saving $2M yearly"}), 5, 5

    out_lie = apply_repairs(
        md_rep, [{"category": "verb_repetition", "count": 2, "source_line": "x"}],
        parsed, answers, LyingGateway(), "u1", TODAY,
    )
    assert "$2M" not in out_lie["markdown"]
    assert out_lie["markdown"] == md_rep  # rejected -> untouched

    class HonestGateway(MockGateway):
        def _invoke_model(self, model, task, content):
            self.calls.append((model, task))
            return json.dumps({target: "- Cut infrastructure cost 23% by right-sizing Kubernetes workloads"}), 5, 5

    gw = HonestGateway()
    out = apply_repairs(
        md_rep, [{"category": "verb_repetition", "count": 2, "source_line": "x"}],
        parsed, answers, gw, "u1", TODAY,
    )
    assert "- Cut infrastructure cost 23% by right-sizing Kubernetes workloads" in out["markdown"]
    assert gw.calls == [("gemini-flash", "repair")]


# ------------------------------------------------------------ screenshot


def test_screenshot_extraction_normalizes_to_structured_findings():
    class VisionGateway(MockGateway):
        def _invoke_model(self, model, task, content):
            self.calls.append((model, task))
            return json.dumps([
                {"category": "Quantify impact", "count": 6},
                {"category": "Buzzwords", "count": 8},
                {"category": "Made-up nonsense category", "count": 3},
            ]), 50, 10

    gw = VisionGateway()
    findings, note = findings_from_screenshot(gw, "u1", b"fake-image-bytes", TODAY)
    assert note is None
    assert [f["category"] for f in findings] == ["quantify", "buzzwords"]
    assert findings[0]["count"] == 6
    assert gw.calls == [("gemini-flash", "screenshot_extract")]
    # Unknown categories from the model are dropped, never acted on.


def test_screenshot_mock_mode_is_honest():
    findings, note = findings_from_screenshot(MockGateway(), "u1", b"img", TODAY)
    assert findings == []
    assert "mock" in note


# -------------------------------------------------------------- endpoint


class FakeSupa:
    def __init__(self, markdown: str):
        self.markdown = markdown
        self.scores: list[dict] = []
        self.updates: list[dict] = []

    async def select(self, table, params):
        if table == "versions":
            return [{"id": "v1", "resume_id": "r1", "structure_id": "S1",
                     "markdown": self.markdown, "status": "final"}]
        if table == "resumes":
            parsed = parse_resume((FIXTURES / "resume_dense.txt").read_text(encoding="utf-8"))
            return [{"id": "r1", "parsed_json": parsed}]
        if table == "answers":
            return []
        return []

    async def insert(self, table, row):
        self.scores.append(row)
        return {**row, "id": f"s{len(self.scores)}"}

    async def update(self, table, params, patch):
        self.updates.append(patch)
        self.markdown = patch.get("markdown", self.markdown)


def test_repair_endpoint_before_after_scores():
    md, _, _ = final_dense()
    md_buzz = md.replace(
        "- Built REST APIs in Python serving 40k requests per minute",
        "- Results-driven team player building REST APIs in Python serving 40k requests per minute",
    )
    fake = FakeSupa(md_buzz)
    app.dependency_overrides[get_current_user] = lambda: {"id": "user-1"}
    app.dependency_overrides[get_supa] = lambda: fake
    app.dependency_overrides[get_app_gateway] = lambda: MockGateway()
    try:
        client = TestClient(app)
        r = client.post("/versions/v1/repair", json={"findings_text": "Buzzwords: 3 found"})
        assert r.status_code == 200, r.text
        body = r.json()
        assert "before_score" in body and "after_score" in body
        assert body["after_score"] >= body["before_score"]
        assert any("buzzword" in a.lower() for a in body["actions"])
        # external findings + internal re-score both persisted
        sources = [s["source"] for s in fake.scores]
        assert sources == ["external", "internal"]
        assert fake.updates, "patched markdown must be saved"
    finally:
        app.dependency_overrides.clear()
