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
- **Google OAuth client: VERIFIED (2026-07-20).** Two earlier client IDs were
  dead (`...c54bgi` deleted, `...enp79` superseded). Final client
  `220198560971-088gq6jj18ej1u885mnee1f7uoel3l06` + secret validated against
  Google's token endpoint (`invalid_grant` = pair accepted). User enabled the
  provider in Supabase; `/auth/v1/settings` now reports google:true and
  `/auth/v1/authorize?provider=google` 302s to accounts.google.com with that
  exact client_id and the correct redirect_uri. **Credential collection
  complete — every Slice 1 input verified.**
- Supabase publishable key: verified earlier (200 on /auth/v1/health).
- **Secret API key: VERIFIED.** `/rest/v1/` → 200 and privileged
  `/auth/v1/admin/users` → 200 (empty user list, as expected pre-launch).
  Stored in backend/.env (gitignored).

## Batched questions (answer whenever)

- none yet
