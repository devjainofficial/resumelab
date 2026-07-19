"""Apply supabase/migrations/*.sql in filename order, tracking what ran in a
_migrations table. Idempotent: already-applied files are skipped. Each file
runs in its own transaction. Connection details come from backend/.env.

Usage: python scripts/apply_migrations.py
"""

from __future__ import annotations

import sys
from pathlib import Path

import psycopg

BACKEND_DIR = Path(__file__).resolve().parent.parent
MIGRATIONS_DIR = BACKEND_DIR.parent / "supabase" / "migrations"


def load_env() -> dict[str, str]:
    env: dict[str, str] = {}
    for line in (BACKEND_DIR / ".env").read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, _, v = line.partition("=")
            env[k.strip()] = v.strip()
    return env


def main() -> int:
    env = load_env()
    conn = psycopg.connect(
        host=env["SUPABASE_DB_HOST"],
        port=int(env.get("SUPABASE_DB_PORT", "5432")),
        dbname="postgres",
        user=env["SUPABASE_DB_USER"],
        password=env["SUPABASE_DB_PASSWORD"],
        autocommit=True,
    )
    with conn, conn.cursor() as cur:
        cur.execute(
            """
            create table if not exists public._migrations (
              filename text primary key,
              applied_at timestamptz not null default now()
            )
            """
        )
        # No policies: invisible through the API; owner connections bypass RLS.
        cur.execute("alter table public._migrations enable row level security")
        cur.execute("select filename from public._migrations")
        done = {r[0] for r in cur.fetchall()}

        failed = False
        for path in sorted(MIGRATIONS_DIR.glob("*.sql")):
            if path.name in done:
                print(f"skip     {path.name} (already applied)")
                continue
            sql = path.read_text(encoding="utf-8")
            try:
                with conn.transaction():
                    cur.execute(sql)
                    cur.execute(
                        "insert into public._migrations (filename) values (%s)",
                        (path.name,),
                    )
                print(f"applied  {path.name}")
            except Exception as e:
                print(f"FAILED   {path.name}: {e}")
                failed = True
                break  # later migrations may depend on this one
        return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
