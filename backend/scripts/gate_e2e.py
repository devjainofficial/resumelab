"""End-to-end gate: the full product flow against the REAL backend process
and the REAL Supabase project (mock gateway — zero Gemini tokens).

upload -> wizard -> answers -> compose(FINAL) -> score -> repair -> enhance
(free-flag lane) -> outcome logged -> downloads render.

Creates a throwaway password user, runs everything over HTTP against a
locally spawned uvicorn, deletes the user afterwards.
Run: python scripts/gate_e2e.py
"""

from __future__ import annotations

import io
import os
import subprocess
import sys
import time
import uuid
from pathlib import Path

import httpx

BACKEND = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND))
from scripts.apply_migrations import load_env  # noqa: E402

env = load_env()
BASE = env["SUPABASE_URL"].rstrip("/")
SECRET = env["SUPABASE_SERVICE_ROLE_KEY"]
PUBLISHABLE = "sb_publishable_nb2dkzhTu3Ejm60FoKwoLw_ml1IjdJI"
API = "http://127.0.0.1:8021"

admin = httpx.Client(
    base_url=BASE,
    headers={"apikey": SECRET, "Authorization": f"Bearer {SECRET}"},
    timeout=30,
)

passed: list[str] = []
failed: list[str] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    (passed if ok else failed).append(name)
    print(f"{'PASS' if ok else 'FAIL'}  {name}" + (f"  ({detail})" if detail else ""))


def make_docx() -> bytes:
    from docx import Document

    doc = Document()
    for line in (BACKEND / "tests/fixtures/resume_dense.txt").read_text(encoding="utf-8").splitlines():
        doc.add_paragraph(line)
    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()


def main() -> int:
    proc_env = {**os.environ, **env, "LLM_GATEWAY_MODE": "mock"}
    server = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "app.main:app", "--port", "8021"],
        cwd=BACKEND, env=proc_env,
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    email = f"gate-e2e-{uuid.uuid4().hex[:8]}@example.com"
    password = uuid.uuid4().hex + "Aa1!"
    uid = None
    try:
        for _ in range(40):
            try:
                if httpx.get(f"{API}/health", timeout=2).status_code == 200:
                    break
            except httpx.TransportError:
                time.sleep(0.5)
        else:
            raise RuntimeError("backend did not start")

        r = admin.post("/auth/v1/admin/users",
                       json={"email": email, "password": password, "email_confirm": True})
        r.raise_for_status()
        uid = r.json()["id"]
        # Free-flag lane for the enhancer, exactly like the admin would flip it.
        admin.patch("/rest/v1/profiles", params={"id": f"eq.{uid}"},
                    json={"is_free_user": True}).raise_for_status()

        jwt = httpx.post(
            f"{BASE}/auth/v1/token?grant_type=password",
            headers={"apikey": PUBLISHABLE},
            json={"email": email, "password": password}, timeout=30,
        ).json()["access_token"]
        api = httpx.Client(base_url=API, headers={"Authorization": f"Bearer {jwt}"}, timeout=120)

        # 1. upload (same bytes twice: python-docx stamps timestamps, so the
        # file must be built once for the dedup check to be meaningful)
        docx_bytes = make_docx()
        r = api.post("/resumes/upload", files={"file": ("mine.docx", docx_bytes)})
        check("upload+parse", r.status_code == 200 and not r.json()["deduped"], f"HTTP {r.status_code}")
        resume_id = r.json()["resume_id"]

        r2 = api.post("/resumes/upload", files={"file": ("again.docx", docx_bytes)})
        check("re-upload dedups at zero cost", r2.json().get("deduped") is True)

        # 2. wizard
        r = api.post("/wizard/start", json={"resume_id": resume_id})
        check("wizard start", r.status_code == 200 and 0 < len(r.json()["questions"]) <= 10,
              f"{len(r.json().get('questions', []))} questions")
        version_id = r.json()["version_id"]
        questions = r.json()["questions"]

        canned = {"contact_email": "e2e@example.com", "contact_phone": "+91 90000 10000",
                  "contact_linkedin": "linkedin.com/in/e2e", "target_role": "Backend developer",
                  "skills_list": "Git, Linux"}
        answers = [
            {"id": q["id"], "question": q["question"],
             "answer": canned.get(q["id"], "3" if q["kind"] == "number" else "2020 - 2024")}
            for q in questions if q["kind"] != "mc"
        ]
        r = api.post("/wizard/answers", json={"version_id": version_id, "answers": answers})
        check("answers stored", r.status_code == 200 and r.json()["stored"] == len(answers))

        # 3. compose -> FINAL
        r = api.post(f"/versions/{version_id}/compose")
        check("compose FINAL", r.status_code == 200 and r.json()["status"] == "final",
              f"status={r.json().get('status')}, open={[q['id'] for q in r.json().get('open_questions', [])]}")

        # 4. score
        r = api.post(f"/versions/{version_id}/score", json={})
        check("score stored", r.status_code == 200 and r.json()["value"] >= 70,
              f"score={r.json().get('value')}")

        # 5. repair (text findings)
        r = api.post(f"/versions/{version_id}/repair",
                     json={"findings_text": "Buzzwords: 2 found\nQuantify impact: 3"})
        body = r.json()
        check("repair before/after", r.status_code == 200 and "before_score" in body and "after_score" in body)

        # 6. enhance (free-flag lane)
        jd = ("Senior Backend Engineer: Python, Kafka, PostgreSQL, Kubernetes, "
              "AWS, Terraform, payment systems, low latency APIs required.")
        r = api.post(f"/versions/{version_id}/enhance", json={"jd_text": jd})
        check("enhance free-flag lane", r.status_code == 200 and r.json()["lane"] == "free_flag",
              f"lane={r.json().get('lane')}")
        check("coverage report present", bool(r.json().get("coverage", {}).get("present")))

        # 7. outcome
        r = api.post("/outcomes", json={"version_id": version_id, "sent_to": "E2E Corp",
                                        "sent_date": "2026-07-20"})
        check("outcome logged", r.status_code == 200)
        r = api.get("/outcomes")
        check("outcomes dashboard data", r.status_code == 200 and len(r.json()) == 1
              and r.json()[0]["score"] is not None)

        # 8. downloads
        r = api.get(f"/versions/{version_id}/download/pdf")
        check("pdf download", r.status_code == 200 and r.content[:4] == b"%PDF")
        r = api.get(f"/versions/{version_id}/download/docx")
        check("docx download", r.status_code == 200 and len(r.content) > 1000)

        # 9. llm_usage: every gateway call persisted with its tier, plus the
        # billing lane row; models must only ever be flash/flash-lite tiers.
        rows = admin.get("/rest/v1/llm_usage",
                         params={"user_id": f"eq.{uid}", "select": "task,model"}).json()
        tasks = sorted({row["task"] for row in rows})
        gateway_rows = [r_ for r_ in rows if r_["task"] != "jd_enhance_run"]
        tiers_ok = all(r_["model"].startswith("gemini-flash") for r_ in gateway_rows)
        check("llm usage logged, tiered only",
              "gap_detect" in tasks and "jd_enhance_run" in tasks and tiers_ok,
              f"tasks={tasks}")
    finally:
        if uid:
            admin.delete(f"/auth/v1/admin/users/{uid}")
        server.terminate()
        print(f"\n{len(passed)} passed, {len(failed)} failed; cleanup done")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
