"""Slice 5 gate: finished resume scores high, sparse scores low for stated
reasons; DRAFTs are refused."""

from pathlib import Path

from fastapi.testclient import TestClient

from app.auth import get_current_user
from app.main import app
from app.supa import get_supa
from parsing.parser import parse_resume
from rewrite.composer import compose_markdown
from scoring.keywords import coverage, extract_keywords
from scoring.scorer import score_resume
from tests.test_compose import answers_for_all_gaps

FIXTURES = Path(__file__).parent / "fixtures"


def final_markdown(name: str, structure: str) -> str:
    parsed = parse_resume((FIXTURES / name).read_text(encoding="utf-8"))
    md, status, open_qs = compose_markdown(parsed, answers_for_all_gaps(parsed), structure)
    assert status == "final", [q["id"] for q in open_qs]
    return md


def sparse_final_without_numbers() -> str:
    """Sparse resume finalized with skipped quant answers: an honest user who
    has no metrics. This is the 'scores low' case."""
    parsed = parse_resume((FIXTURES / "resume_sparse.txt").read_text(encoding="utf-8"))
    answers = []
    for q in [q for q in __import__("wizard.gaps", fromlist=["detect_gaps"]).detect_gaps(parsed) if q["kind"] != "mc"]:
        value = "(skipped)" if q["id"].startswith("quant_") or q["id"] == "target_role" else {
            "contact_phone": "+91 90000 10000",
            "contact_linkedin": "linkedin.com/in/rahulv",
            "skills_list": "(skipped)",
        }.get(q["id"], "(skipped)")
        answers.append({"question": f"{q['id']} :: {q['question']}", "answer": value})
    md, status, open_qs = compose_markdown(parsed, answers, "S3")
    assert status == "final", [q["id"] for q in open_qs]
    return md


def test_finished_resume_scores_reasonably_with_breakdown():
    """A finalized dense resume should score well but not perfectly — the
    calibrated scorer is harsher than the old one to match Resume Worded."""
    result = score_resume(final_markdown("resume_dense.txt", "S1"))
    assert result["value"] >= 65, result["checks"]
    ids = [c["id"] for c in result["checks"]]
    for expected in ("parse_back", "one_page", "headings", "contact",
                     "verb_first", "achievement", "placeholders",
                     "weak_language", "buzzwords", "start_variety"):
        assert expected in ids
    # Every check is user-readable: label + detail present.
    assert all(c["label"] and c["detail"] for c in result["checks"])


def test_sparse_resume_scores_low_for_stated_reasons():
    dense = score_resume(final_markdown("resume_dense.txt", "S1"))
    sparse = score_resume(sparse_final_without_numbers())

    assert sparse["value"] < dense["value"] - 10
    by_id = {c["id"]: c for c in sparse["checks"]}
    # The reason is stated: no impact signals in bullets.
    assert by_id["achievement"]["points"] == 0
    assert "0%" in by_id["achievement"]["detail"]


def test_weak_phrases_and_buzzwords_penalize():
    """Adding 'responsible for' and 'team player' should measurably drop
    the score even on an otherwise strong resume."""
    md = final_markdown("resume_dense.txt", "S1")
    clean = score_resume(md)
    dirty_md = md + "\n- Responsible for working on team-player collaboration\n"
    dirty = score_resume(dirty_md)
    assert dirty["value"] < clean["value"]
    weak = next(c for c in dirty["checks"] if c["id"] == "weak_language")
    buzz = next(c for c in dirty["checks"] if c["id"] == "buzzwords")
    assert weak["points"] < weak["max_points"]
    assert buzz["points"] < buzz["max_points"]


def test_deterministic_same_input_same_score():
    md = final_markdown("resume_dense.txt", "S1")
    assert score_resume(md) == score_resume(md)


def test_jd_coverage_changes_score():
    md = final_markdown("resume_dense.txt", "S1")
    jd_match = "Looking for Python engineer with Kafka, PostgreSQL, AWS, Kubernetes, Docker experience"
    jd_miss = "Seeking Rust engineer: embedded firmware, RTOS, bare-metal, oscilloscope debugging, MISRA"
    hit = score_resume(md, jd_match)
    miss = score_resume(md, jd_miss)
    assert hit["value"] > miss["value"]
    missing_detail = next(c for c in miss["checks"] if c["id"] == "keywords")["detail"]
    assert "missing" in missing_detail


def test_keyword_extraction_is_deterministic_and_sane():
    jd = "We need Python, Python, Django and PostgreSQL. Django preferred."
    kws = extract_keywords(jd)
    assert kws[0] == "python"  # frequency order
    assert "django" in kws and "postgresql" in kws
    assert "and" not in kws  # stopwords dropped
    ratio, present, missing = coverage("I use Python and Django daily", kws)
    assert 0 < ratio < 1 and "postgresql" in missing


def test_placeholder_markers_cost_points():
    md = final_markdown("resume_dense.txt", "S1").replace(
        "Led migration", "Led migration of [COMPANY]"
    )
    result = score_resume(md)
    ph = next(c for c in result["checks"] if c["id"] == "placeholders")
    assert ph["points"] == 0
    assert "[COMPANY]" in ph["detail"]


# ------------------------------------------------------------- endpoint


class FakeSupa:
    def __init__(self, markdown: str, status: str):
        self.markdown = markdown
        self.status = status
        self.scores: list[dict] = []

    async def select(self, table, params):
        if table == "versions":
            return [{"id": "v1", "resume_id": "r1", "structure_id": "S1",
                     "markdown": self.markdown, "status": self.status}]
        if table == "resumes":
            return [{"id": "r1", "parsed_json": {}}]
        return []

    async def insert(self, table, row):
        assert table == "scores"
        self.scores.append(row)
        return {**row, "id": "s1"}


def client_with(fake) -> TestClient:
    app.dependency_overrides[get_current_user] = lambda: {"id": "user-1"}
    app.dependency_overrides[get_supa] = lambda: fake
    return TestClient(app)


def teardown_function():
    app.dependency_overrides.clear()


def test_endpoint_refuses_drafts():
    fake = FakeSupa("> DRAFT\n# X\n", "draft")
    r = client_with(fake).post("/versions/v1/score", json={})
    assert r.status_code == 409
    assert "Draft" in r.json()["detail"]
    assert fake.scores == []  # nothing stored for drafts


def test_endpoint_scores_final_and_stores():
    fake = FakeSupa(final_markdown("resume_dense.txt", "S1"), "final")
    r = client_with(fake).post("/versions/v1/score", json={})
    assert r.status_code == 200
    assert r.json()["value"] >= 65
    assert len(fake.scores) == 1
    assert fake.scores[0]["source"] == "internal"
    assert fake.scores[0]["value"] == r.json()["value"]
