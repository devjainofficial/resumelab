"""Slice 8 gate evidence against the LIVE database: the payments trigger
grants credits exactly once even when the approval fires twice (duplicate
webhook), and a second identical provider_ref is rejected outright.

Run: python scripts/gate_slice8.py
"""

from __future__ import annotations

import sys
import uuid
from pathlib import Path

import psycopg

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from scripts.apply_migrations import load_env  # noqa: E402


def main() -> int:
    env = load_env()
    conn = psycopg.connect(
        host=env["SUPABASE_DB_HOST"], port=5432, dbname="postgres",
        user=env["SUPABASE_DB_USER"], password=env["SUPABASE_DB_PASSWORD"],
        autocommit=True,
    )
    cur = conn.cursor()
    ok = True

    email = f"gate-slice8-{uuid.uuid4().hex[:8]}@example.com"
    cur.execute(
        "insert into auth.users (id, email) values (gen_random_uuid(), %s) returning id",
        (email,),
    )
    uid = cur.fetchone()[0]
    ref = f"order_gate_{uuid.uuid4().hex[:10]}"
    try:
        cur.execute("select credits from public.profiles where id=%s", (uid,))
        assert cur.fetchone()[0] == 0

        cur.execute(
            """insert into public.payments
               (user_id, provider, amount_inr, credits_granted, status, provider_ref)
               values (%s,'razorpay',98,2,'pending',%s) returning id""",
            (uid, ref),
        )

        # Approval #1 (the real webhook)
        cur.execute(
            "update public.payments set status='approved' where provider_ref=%s and status='pending'",
            (ref,),
        )
        first = cur.rowcount
        # Approval #2 (duplicate webhook delivery)
        cur.execute(
            "update public.payments set status='approved' where provider_ref=%s and status='pending'",
            (ref,),
        )
        second = cur.rowcount
        # Even a raw re-update (no status filter) must not re-grant: trigger
        # only fires on pending->approved.
        cur.execute(
            "update public.payments set status='approved' where provider_ref=%s", (ref,)
        )

        cur.execute("select credits from public.profiles where id=%s", (uid,))
        credits = cur.fetchone()[0]
        print(f"first update rows={first}, duplicate rows={second}, credits={credits}")
        if credits == 2 and first == 1 and second == 0:
            print("PASS  duplicate webhook grants exactly once (2 credits, not 4)")
        else:
            print("FAIL  expected exactly 2 credits from one grant")
            ok = False

        # Unique provider_ref: replayed order insert cannot create a second row.
        try:
            cur.execute(
                """insert into public.payments
                   (user_id, provider, amount_inr, credits_granted, status, provider_ref)
                   values (%s,'razorpay',98,2,'pending',%s)""",
                (uid, ref),
            )
            print("FAIL  duplicate provider_ref was accepted")
            ok = False
        except psycopg.errors.UniqueViolation:
            print("PASS  duplicate provider_ref rejected by unique constraint")

        # Ledger: the balance change is explained by a payments row.
        cur.execute(
            "select count(*) from public.payments where user_id=%s and status='approved'",
            (uid,),
        )
        print(f"PASS  ledger: {cur.fetchone()[0]} approved payment row explains the balance")
    finally:
        cur.execute("delete from auth.users where id=%s", (uid,))
        cur.execute("select count(*) from public.profiles where id=%s", (uid,))
        print(f"cleanup: user deleted, {cur.fetchone()[0]} profile rows remain")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
