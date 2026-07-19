# BUILDLOG

Gate evidence and batched questions. Newest entries at the top.

## Phase 2 — repo + CI scaffold (2026-07-19)

**What was built:** monorepo scaffold — Next.js 14 + Tailwind frontend
(builds with zero env vars so Vercel can deploy before Supabase wiring),
FastAPI backend with `llm/gateway.py` (mock mode, cache, tiering, budget
enforcement) and pytest suite, initial Supabase migration (full schema + RLS
+ profile/credit triggers), GitHub Actions CI (frontend build on Node 20,
backend pytest on Python 3.11 with LLM_GATEWAY_MODE=mock).

**Verification (local, 2026-07-19):**
- `backend`: fresh venv (Python 3.12 local; CI pins 3.11), `pip install -r
  requirements.txt`, `python -m pytest -v` → **12 passed** in 0.85s. Tests
  cover: cache hit skips model, cache keyed by (task, content hash), model
  tiering (flash-lite vs flash), unknown task rejected, per-user budget with
  friendly message, per-user cap doesn't block other users, global cap,
  cache served even over budget, every call logged, factory defaults to
  mock, real mode refuses to start without GEMINI_API_KEY.
- `frontend`: `npm run build` → Next.js 14.2.35 compiled successfully,
  static routes generated, zero env vars required.
- CI run on GitHub: https://github.com/devjainofficial/resumelab/actions/runs/29688435830
  → conclusion **success**; jobs "Frontend build" and "Backend tests (mock
  gateway)" both green on Python 3.11 / Node 20.

## Phase 2 — CI/CD end-to-end verification (2026-07-19)

- User linked the repo to Vercel; frontend live at https://resumelabai.vercel.app
- Push-to-redeploy proven: commit `08aca82` (adds a `<meta name="commit">`
  deploy stamp) appeared on the live site ~30s after `git push` — verified by
  polling for the exact SHA in the served HTML.
- GitHub Actions on the same commit: run 29689272667 → **success**.
- Supabase project live: `https://zngellmrkdblinlqupbe.supabase.co` responds
  200 on /auth/v1/health with the publishable key. Saved to frontend/.env.local
  and backend/.env (both gitignored). Still pending from user: secret key,
  Google provider enablement, DB password + access token for migrations.

## Credential verification (2026-07-19)

- **DB password: VERIFIED.** Connected via session pooler
  `aws-1-ap-northeast-2.pooler.supabase.com:5432` as
  `postgres.zngellmrkdblinlqupbe` → `select version()` returned
  PostgreSQL 17.6. Project region is ap-northeast-2 (Seoul). Direct host
  `db.<ref>.supabase.co` is IPv6-only and unreachable from the dev network —
  always use the pooler locally. Migrations can now be applied via direct
  Postgres connection; the CLI access token is optional.
- **Google OAuth client: FAILED.** Token endpoint returned
  `deleted_client` for `220198560971-...c54bgi` — that client was deleted in
  Google Cloud. Waiting on the user for the currently-existing client's ID +
  secret.
- Supabase publishable key: verified earlier (200 on /auth/v1/health).
- Secret API key: still pending from user (in-app browser clipboard is
  sandboxed; user will copy from their own browser).

## Batched questions (answer whenever)

- none yet
