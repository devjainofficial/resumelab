"""Slice 3 gate: a sparse resume yields sensible, non-redundant questions
capped at 10; answers are stored as user-stated facts; the flash-lite pass
goes through the gateway (cached, logged, harmless in mock mode)."""

from datetime import date
from pathlib import Path

from fastapi.testclient import TestClient

from app.auth import get_current_user
from app.gateway_dep import get_app_gateway
from app.main import app
from app.supa import get_supa
from llm.gateway import MockGateway
from parsing.parser import parse_resume
from wizard.gaps import HARD_CAP, detect_gaps, refine_questions

FIXTURES = Path(__file__).parent / "fixtures"
TODAY = date(2026, 7, 20)


def parsed_fixture(name: str) -> dict:
    return parse_resume((FIXTURES / name).read_text(encoding="utf-8"))


# ------------------------------------------------------------ gap detection


def test_sparse_resume_questions_sensible_and_capped():
    p = parsed_fixture("resume_sparse.txt")
    qs = detect_gaps(p)

    assert 0 < len(qs) <= HARD_CAP
    ids = [q["id"] for q in qs]
    assert len(ids) == len(set(ids)), "redundant questions"

    # Missing phone and linkedin -> contact questions
    assert "contact_phone" in ids
    assert "contact_linkedin" in ids
    # But NOT email — the resume has one; asking would be redundant.
    assert "contact_email" not in ids
    # The unquantified bullet becomes a numeric question, never a guess.
    quant = [q for q in qs if q["id"].startswith("quant_")]
    assert quant and "Helped with website" in quant[0]["question"]
    assert quant[0]["kind"] == "number"
    # Thin skills -> skills question; thin summary -> target role question.
    assert "skills_list" in ids
    assert "target_role" in ids
    # Ordered by impact, descending.
    impacts = [q["score_impact"] for q in qs]
    assert impacts == sorted(impacts, reverse=True)


def test_dense_resume_yields_far_fewer_questions():
    sparse_n = len(detect_gaps(parsed_fixture("resume_sparse.txt")))
    dense_qs = detect_gaps(parsed_fixture("resume_dense.txt"))
    dense_ids = [q["id"] for q in dense_qs]

    assert len(dense_qs) < sparse_n
    # Dense resume has phone/linkedin/email: no contact questions at all.
    assert not any(i.startswith("contact_") for i in dense_ids)
    # It still asks about unquantified bullets ("Managed a team of...era" has
    # numbers; only truly unnumbered bullets qualify).
    for q in dense_qs:
        if q["id"].startswith("quant_"):
            assert not any(ch.isdigit() for ch in q["question"].split('"')[1])


def test_cap_is_hard_even_for_pathological_input():
    text = "A B\n" + "Experience\n" + "\n".join(
        f"Role {i}\nCompany {i}\n• did some work without numbers" for i in range(30)
    )
    qs = detect_gaps(parse_resume(text))
    assert len(qs) <= HARD_CAP


# ----------------------------------------------------- gateway refinement


def test_refine_goes_through_gateway_and_mock_is_safe():
    gw = MockGateway()
    p = parsed_fixture("resume_sparse.txt")
    qs = detect_gaps(p)
    refined = refine_questions(gw, "u1", p, qs, TODAY)

    assert refined == qs  # mock returns non-JSON -> deterministic set stands
    assert gw.calls == [("gemini/gemini-2.0-flash-lite", "gap_detect")]  # tiering respected
    assert len(gw.usage_log) == 1

    # Second run with identical input: cache hit, no new model call.
    refine_questions(gw, "u1", p, qs, TODAY)
    assert len(gw.calls) == 1


def test_refine_cannot_add_unknown_questions():
    class EvilGateway(MockGateway):
        def _invoke_model(self, model, task, content):
            self.calls.append((model, task))
            return (
                '[{"id": "contact_phone"}, {"id": "invented_salary_question"}]',
                10,
                5,
            )

    gw = EvilGateway()
    p = parsed_fixture("resume_sparse.txt")
    qs = detect_gaps(p)
    refined = refine_questions(gw, "u1", p, qs, TODAY)
    ids = [q["id"] for q in refined]
    assert "invented_salary_question" not in ids
    assert ids == ["contact_phone"]


# ------------------------------------------------------------- endpoints


class FakeSupa:
    def __init__(self, parsed):
        self.parsed = parsed
        self.versions: list[dict] = []
        self.answers: list[dict] = []

    async def select(self, table, params):
        if table == "resumes":
            return [{"id": "r1", "parsed_json": self.parsed}]
        if table == "versions":
            return [v for v in self.versions if v["id"] == params["id"].removeprefix("eq.")]
        return []

    async def insert(self, table, row):
        if table == "versions":
            row = {**row, "id": f"v{len(self.versions) + 1}"}
            self.versions.append(row)
        elif table == "answers":
            row = {**row, "id": f"a{len(self.answers) + 1}"}
            self.answers.append(row)
        return row


def wizard_client(parsed) -> tuple[TestClient, FakeSupa, MockGateway]:
    fake = FakeSupa(parsed)
    gw = MockGateway()
    app.dependency_overrides[get_current_user] = lambda: {"id": "user-1"}
    app.dependency_overrides[get_supa] = lambda: fake
    app.dependency_overrides[get_app_gateway] = lambda: gw
    return TestClient(app), fake, gw


def teardown_function():
    app.dependency_overrides.clear()


def test_wizard_start_creates_draft_and_questions():
    client, fake, gw = wizard_client(parsed_fixture("resume_sparse.txt"))
    r = client.post("/wizard/start", json={"resume_id": "r1"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["version_id"] == "v1"
    assert body["structure_id"] == "S3"  # fresher signals -> S3
    assert 0 < len(body["questions"]) <= HARD_CAP
    assert fake.versions[0]["status"] == "draft"
    assert len(gw.usage_log) == 1  # exactly one flash-lite pass


def test_answers_stored_as_facts_blank_dropped():
    client, fake, _ = wizard_client(parsed_fixture("resume_sparse.txt"))
    client.post("/wizard/start", json={"resume_id": "r1"})
    r = client.post(
        "/wizard/answers",
        json={
            "version_id": "v1",
            "answers": [
                {"question": "Team size?", "answer": "4"},
                {"question": "Users?", "answer": "   "},
            ],
        },
    )
    assert r.status_code == 200
    assert r.json() == {"stored": 2}
    assert fake.answers[0]["answer"] == "4"
    # Blank answer = "fact doesn't exist": stored as an explicit skip so the
    # gap closes without inventing anything.
    assert fake.answers[1]["answer"] == "(skipped)"
