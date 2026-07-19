"""Slice 1 gate evidence: signup trigger, RLS isolation, logged-out blocking.

Creates two throwaway users via the admin API, signs them in, exercises the
REST API as each user and as an anonymous caller, asserts every isolation
property, then deletes the users. Run: python scripts/gate_slice1.py
"""

from __future__ import annotations

import sys
import uuid
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from scripts.apply_migrations import load_env  # noqa: E402

env = load_env()
BASE = env["SUPABASE_URL"].rstrip("/")
SECRET = env["SUPABASE_SERVICE_ROLE_KEY"]
PUBLISHABLE = "sb_publishable_nb2dkzhTu3Ejm60FoKwoLw_ml1IjdJI"

admin = httpx.Client(
    base_url=BASE,
    headers={"apikey": SECRET, "Authorization": f"Bearer {SECRET}"},
    timeout=20,
)
checks: list[tuple[str, bool, str]] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    checks.append((name, ok, detail))
    print(f"{'PASS' if ok else 'FAIL'}  {name}" + (f"  ({detail})" if detail else ""))


def make_user(tag: str) -> tuple[str, str, str]:
    email = f"gate-slice1-{tag}-{uuid.uuid4().hex[:8]}@example.com"
    password = uuid.uuid4().hex + "Aa1!"
    r = admin.post(
        "/auth/v1/admin/users",
        json={"email": email, "password": password, "email_confirm": True},
    )
    r.raise_for_status()
    return r.json()["id"], email, password


def sign_in(email: str, password: str) -> str:
    r = httpx.post(
        f"{BASE}/auth/v1/token?grant_type=password",
        headers={"apikey": PUBLISHABLE},
        json={"email": email, "password": password},
        timeout=20,
    )
    r.raise_for_status()
    return r.json()["access_token"]


def as_user(jwt: str) -> dict:
    return {"apikey": PUBLISHABLE, "Authorization": f"Bearer {jwt}"}


def main() -> int:
    a_id, a_email, a_pw = make_user("a")
    b_id, b_email, b_pw = make_user("b")
    try:
        # 1. Trigger auto-created profiles rows for both signups.
        r = admin.get(
            "/rest/v1/profiles",
            params={"id": f"in.({a_id},{b_id})", "select": "id,email,credits"},
        )
        rows = r.json()
        check("profiles auto-created on signup", len(rows) == 2, f"{len(rows)}/2 rows")
        check(
            "profile defaults (credits=0)",
            all(row["credits"] == 0 for row in rows),
        )

        a_jwt = sign_in(a_email, a_pw)
        b_jwt = sign_in(b_email, b_pw)

        # 2. A inserts a resume; B must not see it.
        r = httpx.post(
            f"{BASE}/rest/v1/resumes",
            headers={**as_user(a_jwt), "Prefer": "return=representation"},
            json={"user_id": a_id, "file_hash": "gatehash", "filename": "gate.pdf"},
            timeout=20,
        )
        check("user A can insert own resume", r.status_code == 201, f"HTTP {r.status_code}")

        r = httpx.get(f"{BASE}/rest/v1/resumes", headers=as_user(b_jwt), timeout=20)
        check("RLS: B sees zero of A's resumes", r.status_code == 200 and r.json() == [])

        r = httpx.get(f"{BASE}/rest/v1/profiles", headers=as_user(b_jwt), timeout=20)
        ids = [row["id"] for row in r.json()]
        check("RLS: B sees only own profile", ids == [b_id], f"saw {len(ids)} rows")

        # 3. B cannot forge a resume owned by A.
        r = httpx.post(
            f"{BASE}/rest/v1/resumes",
            headers=as_user(b_jwt),
            json={"user_id": a_id, "file_hash": "forged", "filename": "forge.pdf"},
            timeout=20,
        )
        check("RLS: B cannot insert a resume as A", r.status_code in (401, 403), f"HTTP {r.status_code}")

        # 4. B cannot grant themselves credits or the free flag.
        r = httpx.patch(
            f"{BASE}/rest/v1/profiles",
            params={"id": f"eq.{b_id}"},
            headers={**as_user(b_jwt), "Prefer": "return=representation"},
            json={"credits": 9999, "is_free_user": True},
            timeout=20,
        )
        unchanged = (
            admin.get("/rest/v1/profiles", params={"id": f"eq.{b_id}", "select": "credits,is_free_user"})
            .json()[0]
        )
        check(
            "RLS: B cannot self-grant credits/free flag",
            unchanged == {"credits": 0, "is_free_user": False},
            f"HTTP {r.status_code}, row={unchanged}",
        )

        # 5. Anonymous callers (publishable key, no session) see nothing.
        for table in ("profiles", "resumes", "versions", "payments", "llm_usage"):
            r = httpx.get(
                f"{BASE}/rest/v1/{table}",
                headers={"apikey": PUBLISHABLE},
                timeout=20,
            )
            blocked = r.status_code in (401, 403) or r.json() == []
            check(f"anonymous blocked from {table}", blocked, f"HTTP {r.status_code}")

        return 0 if all(ok for _, ok, _ in checks) else 1
    finally:
        for uid in (a_id, b_id):
            admin.delete(f"/auth/v1/admin/users/{uid}")
        # Cascade check: profiles rows must be gone with the users.
        left = admin.get(
            "/rest/v1/profiles", params={"id": f"in.({a_id},{b_id})"}
        ).json()
        print(f"cleanup: test users deleted, {len(left)} profile rows remain")


if __name__ == "__main__":
    raise SystemExit(main())
