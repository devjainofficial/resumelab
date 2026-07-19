"""Slice 7 gate: refuses non-FINAL; zero new facts; access chain enforced
(free flag bypasses, allowance counts, credits decrement atomically, zero
balance shows the paywall)."""

import json
import re
from datetime import date
from pathlib import Path

from fastapi.testclient import TestClient

from app.auth import get_current_user
from app.enhance import REFUSAL
from app.gateway_dep import get_app_gateway
from app.main import app
from app.supa import get_supa
from enhancer.enhance import enhance
from llm.gateway import MockGateway
from parsing.parser import parse_resume
from rewrite.composer import compose_markdown
from tests.test_compose import answers_for_all_gaps

FIXTURES = Path(__file__).parent / "fixtures"
TODAY = date(2026, 7, 20)

JD = """
We're hiring a Senior Backend Engineer. Requirements: Python, Kafka,
PostgreSQL, Kubernetes, AWS, Terraform. Experience with payment systems and
low-latency APIs. Rust and GraphQL are nice to have.
"""


def final_dense() -> tuple[str, dict, list]:
    parsed = parse_resume((FIXTURES / "resume_dense.txt").read_text(encoding="utf-8"))
    answers = answers_for_all_gaps(parsed)
    md, status, _ = compose_markdown(parsed, answers, "S1")
    assert status == "final"
    return md, parsed, answers


# ------------------------------------------------------------ truthfulness


def test_enhancer_adds_zero_new_facts():
    md, parsed, answers = final_dense()
    out = enhance(md, JD, parsed, answers, MockGateway(), "u1", TODAY)
    before_tokens = set(re.findall(r"[A-Za-z0-9+#./-]+", md))
    after_tokens = set(re.findall(r"[A-Za-z0-9+#./-]+", out["markdown"]))
    assert after_tokens <= before_tokens, f"new tokens: {after_tokens - before_tokens}"


def test_experience_section_is_never_touched():
    md, parsed, answers = final_dense()
    out = enhance(md, JD, parsed, answers, MockGateway(), "u1", TODAY)

    def experience_block(m: str) -> list[str]:
        lines, keep, out_lines = m.splitlines(), False, []
        for l in lines:
            if l.startswith("## "):
                keep = l.strip() == "## Experience"
            if keep:
                out_lines.append(l)
        return out_lines

    assert experience_block(out["markdown"]) == experience_block(md)


def test_skills_reorder_leads_with_jd_matches():
    md, parsed, answers = final_dense()
    out = enhance(md, JD, parsed, answers, MockGateway(), "u1", TODAY)
    skills_line = next(
        out["markdown"].splitlines()[i + 1]
        for i, l in enumerate(out["markdown"].splitlines())
        if l.strip() == "## Skills"
    )
    first_three = [s.strip().lower() for s in skills_line.split(",")[:3]]
    assert any("python" in s for s in first_three)
    assert any("kafka" in s or "postgresql" in s or "aws" in s for s in first_three)


def test_coverage_report_is_honest_about_missing():
    md, parsed, answers = final_dense()
    out = enhance(md, JD, parsed, answers, MockGateway(), "u1", TODAY)
    cov = out["coverage"]
    assert "rust" in cov["missing"] or "graphql" in cov["missing"]
    assert "python" in cov["present"]
    assert "never adds unproven skills" in cov["note"]


def test_summary_tailoring_rejects_invented_claims():
    md, parsed, answers = final_dense()

    class LyingGateway(MockGateway):
        def _invoke_model(self, model, task, content):
            self.calls.append((model, task))
            return json.dumps({"summary": "Ex-Google staff engineer, 15 years with Rust"}), 5, 5

    out = enhance(md, JD, parsed, answers, LyingGateway(), "u1", TODAY)
    assert "Google" not in out["markdown"].replace("Google Cloud", "")
    assert "Rust" not in out["markdown"]
    assert "15 years" not in out["markdown"]


# ------------------------------------------------------------ access chain


class BillingFakeSupa:
    def __init__(self, markdown, *, free=False, credits=0, prior_runs=0):
        self.markdown = markdown
        self.free = free
        self.credits = credits
        self.usage_rows = [
            {"id": f"u{i}", "task": "jd_enhance_run"} for i in range(prior_runs)
        ]
        self.inserted_versions: list[dict] = []
        self.rpc_calls: list[tuple] = []

    async def select(self, table, params):
        if table == "versions":
            return [{"id": "v1", "resume_id": "r1", "structure_id": "S1",
                     "markdown": self.markdown, "status": "final"}]
        if table == "resumes":
            parsed = parse_resume((FIXTURES / "resume_dense.txt").read_text(encoding="utf-8"))
            return [{"id": "r1", "parsed_json": parsed}]
        if table == "profiles":
            return [{"is_free_user": self.free, "credits": self.credits}]
        if table == "llm_usage":
            return self.usage_rows
        if table == "answers":
            return []
        return []

    async def insert(self, table, row):
        if table == "llm_usage":
            self.usage_rows.append({**row, "id": f"u{len(self.usage_rows)}"})
        if table == "versions":
            self.inserted_versions.append(row)
            return {**row, "id": "v2"}
        return {**row, "id": "x"}

    async def rpc(self, fn, args):
        self.rpc_calls.append((fn, args))
        if self.credits > 0:
            self.credits -= 1
            self.usage_rows.append({"id": "uc", "task": "jd_enhance_run", "model": "credit"})
            return True
        return False


def enhance_client(fake) -> TestClient:
    app.dependency_overrides[get_current_user] = lambda: {"id": "user-1"}
    app.dependency_overrides[get_supa] = lambda: fake
    app.dependency_overrides[get_app_gateway] = lambda: MockGateway()
    return TestClient(app)


def teardown_function():
    app.dependency_overrides.clear()


def _final_md() -> str:
    md, _, _ = final_dense()
    return md


def test_refuses_non_final_with_exact_message():
    fake = BillingFakeSupa(_final_md())

    async def draft_select(table, params):
        if table == "versions":
            return [{"id": "v1", "resume_id": "r1", "structure_id": "S1",
                     "markdown": "> DRAFT\n", "status": "draft"}]
        return await BillingFakeSupa(_final_md()).select(table, params)

    fake.select = draft_select
    r = enhance_client(fake).post("/versions/v1/enhance", json={"jd_text": JD})
    assert r.status_code == 409
    assert r.json()["detail"] == REFUSAL


def test_refuses_placeholder_resume_with_exact_message():
    fake = BillingFakeSupa(_final_md().replace("Bengaluru", "[CITY]"), free=True)
    r = enhance_client(fake).post("/versions/v1/enhance", json={"jd_text": JD})
    assert r.status_code == 409
    assert r.json()["detail"] == REFUSAL


def test_free_flag_bypasses_but_logs():
    fake = BillingFakeSupa(_final_md(), free=True)
    r = enhance_client(fake).post("/versions/v1/enhance", json={"jd_text": JD})
    assert r.status_code == 200
    assert r.json()["lane"] == "free_flag"
    assert any(row.get("model") == "free_flag" for row in fake.usage_rows)
    assert fake.rpc_calls == []  # no credit touched


def test_allowance_counts_runs(monkeypatch):
    monkeypatch.setenv("FREE_JD_RUNS", "2")
    fake = BillingFakeSupa(_final_md(), prior_runs=1)  # 1 of 2 used
    r = enhance_client(fake).post("/versions/v1/enhance", json={"jd_text": JD})
    assert r.status_code == 200
    assert r.json()["lane"] == "allowance"


def test_credits_decrement_atomically_after_allowance_exhausted(monkeypatch):
    monkeypatch.setenv("FREE_JD_RUNS", "2")
    fake = BillingFakeSupa(_final_md(), prior_runs=2, credits=3)
    r = enhance_client(fake).post("/versions/v1/enhance", json={"jd_text": JD})
    assert r.status_code == 200
    assert r.json()["lane"] == "credit"
    assert fake.rpc_calls == [("use_jd_credit", {"p_user": "user-1"})]
    assert fake.credits == 2


def test_zero_balance_shows_paywall_not_error(monkeypatch):
    monkeypatch.setenv("FREE_JD_RUNS", "2")
    monkeypatch.setenv("JD_CREDIT_PRICE_INR", "49")
    fake = BillingFakeSupa(_final_md(), prior_runs=2, credits=0)
    r = enhance_client(fake).post("/versions/v1/enhance", json={"jd_text": JD})
    assert r.status_code == 402
    detail = r.json()["detail"]
    assert detail["paywall"] is True
    assert detail["price_inr"] == 49
    assert "free forever" in detail["message"]
    assert fake.inserted_versions == []  # nothing ran


def test_successful_run_creates_new_final_variant():
    fake = BillingFakeSupa(_final_md(), free=True)
    r = enhance_client(fake).post("/versions/v1/enhance", json={"jd_text": JD})
    assert r.status_code == 200
    assert r.json()["variant_version_id"] == "v2"
    assert fake.inserted_versions[0]["status"] == "final"
    assert fake.inserted_versions[0]["resume_id"] == "r1"
