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

## Batched questions (answer whenever)

- none yet
