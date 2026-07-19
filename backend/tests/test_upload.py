"""Slice 2 gate: upload endpoint — dedup means a re-upload does zero parse
work and zero LLM tokens (the path contains no gateway call at all)."""

import io
from pathlib import Path

from fastapi.testclient import TestClient

import app.resumes as resumes_module
from app.auth import get_current_user
from app.main import app
from app.supa import get_supa

FIXTURES = Path(__file__).parent / "fixtures"


class FakeSupa:
    def __init__(self):
        self.rows: list[dict] = []
        self.uploads: list[str] = []

    async def select(self, table, params):
        assert table == "resumes"
        user_id = params["user_id"].removeprefix("eq.")
        file_hash = params.get("file_hash", "").removeprefix("eq.")
        return [
            r
            for r in self.rows
            if r["user_id"] == user_id and (not file_hash or r["file_hash"] == file_hash)
        ]

    async def insert(self, table, row):
        row = {**row, "id": f"resume-{len(self.rows) + 1}"}
        self.rows.append(row)
        return row

    async def upload_file(self, bucket, path, data, content_type):
        self.uploads.append(path)


def make_docx_bytes() -> bytes:
    from docx import Document

    doc = Document()
    for line in (FIXTURES / "resume_dense.txt").read_text(encoding="utf-8").splitlines():
        doc.add_paragraph(line)
    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()


def client_with(fake: FakeSupa) -> TestClient:
    app.dependency_overrides[get_current_user] = lambda: {"id": "user-1", "email": "u@example.com"}
    app.dependency_overrides[get_supa] = lambda: fake
    return TestClient(app)


def teardown_function():
    app.dependency_overrides.clear()


def test_upload_parses_and_stores():
    fake = FakeSupa()
    client = client_with(fake)
    data = make_docx_bytes()

    r = client.post("/resumes/upload", files={"file": ("mine.docx", data)})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["deduped"] is False
    assert body["parsed"]["contact"]["email"] == "priya.sharma@example.com"
    assert len(fake.uploads) == 1
    assert fake.uploads[0].startswith("user-1/")
    assert len(fake.rows) == 1


def test_reupload_same_file_costs_zero(monkeypatch):
    fake = FakeSupa()
    client = client_with(fake)
    data = make_docx_bytes()

    r1 = client.post("/resumes/upload", files={"file": ("mine.docx", data)})
    assert r1.json()["deduped"] is False

    parse_calls = {"n": 0}
    real_parse = resumes_module.parse_resume

    def counting_parse(text):
        parse_calls["n"] += 1
        return real_parse(text)

    monkeypatch.setattr(resumes_module, "parse_resume", counting_parse)

    r2 = client.post("/resumes/upload", files={"file": ("renamed.docx", data)})
    assert r2.status_code == 200
    assert r2.json()["deduped"] is True
    assert r2.json()["resume_id"] == r1.json()["resume_id"]
    assert parse_calls["n"] == 0  # no parse work on dedup
    assert len(fake.uploads) == 1  # no second storage write
    assert len(fake.rows) == 1  # no second DB row


def test_upload_rejects_unsupported_type():
    client = client_with(FakeSupa())
    r = client.post("/resumes/upload", files={"file": ("resume.txt", b"hello " * 20)})
    assert r.status_code == 422


def test_upload_rejects_unreadable_pdf():
    client = client_with(FakeSupa())
    r = client.post("/resumes/upload", files={"file": ("bad.pdf", b"not a real pdf")})
    assert r.status_code == 422


def test_upload_requires_auth():
    app.dependency_overrides.clear()
    client = TestClient(app)
    r = client.post("/resumes/upload", files={"file": ("mine.docx", b"x")})
    assert r.status_code == 401
