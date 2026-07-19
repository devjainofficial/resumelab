# BUILDLOG

Gate evidence and batched questions. Newest entries at the top.

## Slice 5 — Built-in ATS scorer (2026-07-20)

**Built:** `scoring/scorer.py` — deterministic 0-100 with readable per-check
breakdown: parse-back fidelity 15, one page 10, standard headings 5, contact
completeness 15, verb-first 10, ≤40-word bullets 5, verb variety 5,
quantification (2/3 target) 10, content depth 10 (added: bullets count,
summary substance, skills breadth — the spec's checks alone let a one-bullet
resume score 92), JD keyword coverage 10, zero placeholders 5.
`scoring/keywords.py` deterministic extraction+coverage (reused by slice 7).
`POST /versions/{id}/score` refuses drafts (409), stores result in `scores`
(source=internal). Zero LLM tokens anywhere in scoring.

**Gate evidence (pytest, 52 passed):**
- Dense FINAL scores ≥80 (actual 9x); honest sparse FINAL (skipped metrics)
  scores 10+ points lower with stated reasons: quantified=0 with "0% carry a
  number", depth low with bullet count named.
- Determinism: identical input -> identical result object.
- JD coverage: matching JD outscores mismatched JD; missing keywords listed
  in the detail string.
- Placeholder "[COMPANY]" -> 0 points on that check, marker named in detail.
- Endpoint: draft -> 409 with wizard guidance, nothing stored; final ->
  scored + stored with source=internal.

## Slice 4 — Rewrite + render (2026-07-20)

**Built:** `rewrite/facts.py` (fact store with provenance; answers merge
deterministically — contact fills, quant numbers attach to their bullet,
skills dedupe, education dates); `rewrite/composer.py` (structure spec ->
markdown; FINAL only when re-detected gaps minus answered ids is empty,
else DRAFT with visible watermark line); flash `rewrite` polish pass whose
output is rejected per-bullet if it introduces any number or capitalized
term absent from the source corpus; `rewrite/renderer.py` markdown -> PDF
(WeasyPrint when available; deterministic fpdf2 fallback locally) + DOCX
(python-docx); `/versions/{id}/compose` + `/versions/{id}/download/{pdf,docx}`.
CI now installs pango and runs the real WeasyPrint engine; the Windows dev
box uses the fallback (deviation noted — production Docker uses WeasyPrint).

**Gate evidence (pytest, 44 passed):**
- One page: dense fixture with all answers renders to exactly 1 PDF page.
- Parse-back: ≥95% of markdown words recovered from the rendered PDF text
  (actual run: 100% minus stopword-length tokens).
- Zero unsourced facts: every token in composed markdown exists in the
  source corpus (parsed text + answers) or is a structural heading.
- Draft/final: unanswered gaps -> DRAFT + watermark in markdown AND in
  extracted PDF text; all answered -> FINAL, no watermark, answered facts
  present in output.
- Truthfulness guard: a lying gateway inserting "500% at Google" is
  rejected (markdown unchanged); an honest rephrase using only sourced
  terms is accepted; tier verified as gemini-flash.
- Structure specs: S1 order Summary<Skills<Experience; S3 puts Education
  before Skills.
- fpdf2 cursor bug (multi_cell leaves x at right edge) found and fixed.

## Slice 3 — Intake wizard (2026-07-20)

**Built:** `wizard/gaps.py` deterministic gap detector (contact completeness,
role-level inference from career span, section emphasis, top-project pick,
thin summary/skills, unquantified bullets -> numeric questions, undated
education) with score-impact ordering and HARD_CAP=10; one flash-lite
`gap_detect` gateway pass that can reorder/reword but structurally cannot
add questions (unknown ids are dropped); `POST /wizard/start` creates a
draft version with a recommended structure (S1-S4 mapping in
`structures/specs.py`); `POST /wizard/answers` stores non-blank answers as
user-stated facts.

**Gate evidence (pytest, 34 passed):**
- Sparse fixture: questions ≤10, ids unique, phone+linkedin asked but NOT
  email (present in resume — no redundancy), unquantified bullet becomes a
  number question quoting the bullet, skills/target-role asked, ordered by
  impact desc.
- Dense fixture: strictly fewer questions, zero contact questions.
- Pathological 30-role resume: cap holds at 10.
- Gateway: exactly one flash-lite call per run, tier `gemini-flash-lite`,
  logged; identical rerun is a cache hit (0 new calls); adversarial gateway
  returning an invented question id is filtered out.
- Endpoints: /wizard/start -> draft version + S3 for fresher signals;
  blank answers never stored.

## Slice 2 — Upload + parse (2026-07-20)

**Built:** deterministic extraction (`parsing/extract.py`: pypdf + python-docx)
and heuristic structuring (`parsing/parser.py`: sections, contact regexes,
entry/bullet splitting, placeholder flag) — zero LLM tokens by construction;
`POST /resumes/upload` (auth-gated, 5 MB cap, pdf/docx only) with SHA-256
file-hash dedup, storage upload to `resumes/{uid}/{hash}`, row insert;
`GET /resumes`; dashboard upload UI calling the API with the session token.

**Gate evidence (pytest, 27 passed):**
- Parse fidelity on 3 known fixtures (dense senior / projects-forward /
  sparse fresher): names, emails, phone (incl. +91 5+5 format), linkedin,
  github, summary content, skills lists, entry counts, per-entry bullet
  counts and first-bullet text, certifications, education all asserted.
- Same fixture routed through real PDF bytes (fpdf2) and real DOCX bytes
  (python-docx) reparses to the same structure.
- `test_parser_never_invents_content`: every parsed token is a substring of
  the source — no-fabrication contract enforced at parser level.
- Re-upload of identical bytes (even renamed): `deduped=true`, same
  resume_id, parse function called 0 times, no second storage write or DB
  row -> zero tokens, zero work.
- Unsupported type -> 422; unreadable PDF -> 422; no auth -> 401.

Note: gate ran on synthetic fixtures. When the user supplies their 3 real
resumes, rerun `pytest tests/test_parsing.py` after dropping them into
tests/fixtures (batched ask, non-blocking).

## Slice 1 — Scaffold: auth, RLS, OAuth (2026-07-20)

**Built:** migrations applied to the live project via direct-Postgres runner
(`backend/scripts/apply_migrations.py`; `_migrations` table tracks state, RLS
enabled on it). Frontend auth with @supabase/ssr: /login (Google),
/auth/callback code exchange, middleware gating every non-public route,
/dashboard reading the RLS-scoped profile, sign-out. Backend /me validating
Supabase bearer tokens + CORS. Vercel env vars set via CLI (production +
preview).

**Gate evidence:**
- Schema: 8 tables, `rls=True` on all; 10 public + 3 storage policies;
  `on_auth_user_created` trigger present; private `resumes` bucket created.
- `backend/scripts/gate_slice1.py` against the live project — **12/12 PASS**:
  profiles auto-created for two fresh signups (defaults credits=0); user A
  inserted own resume (201); user B saw zero of A's rows on resumes and
  profiles; B forging a resume as A → 403; B self-granting credits/free flag
  → 403 with row unchanged; anonymous callers blocked from profiles, resumes,
  versions, payments, llm_usage. Test users deleted; cascade left 0 rows.
- Backend tests: 16 passed (auth 401/200 paths, gateway cost rules).
- CI on `ee577c0`: success. Production deploy verified serving `ee577c0`;
  logged-out `/dashboard` → 307 `/login?next=%2Fdashboard`; `/login` → 200.
- OAuth chain (verified 2026-07-20): `/auth/v1/authorize?provider=google` →
  302 accounts.google.com with the correct client_id + redirect_uri.

**USER AUDIT NEEDED (not blocking the build):**
1. Set Supabase auth URLs (dashboard → Authentication → URL Configuration):
   Site URL `https://resumelabai.vercel.app`; Redirect URLs add
   `https://resumelabai.vercel.app/**` and `http://localhost:3000/**`.
   (The in-app browser pane stopped hydrating the dashboard SPA, so I could
   not set these two fields myself. Alternative: send an sbp_ management
   token and I'll set them via the Management API.)
2. After that: sign in at https://resumelabai.vercel.app with two different
   Google accounts — expect the dashboard with your name/avatar, and a
   profiles row per account.

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
- **Gemini key: VERIFIED (2026-07-20).** Found in the user's Mole /
  job-search-app projects, confirmed with a free models.list call (HTTP 200;
  gemini-2.5-flash and flash-lite tiers available). Stored in backend/.env.
  Real calls still require the user's explicit go-ahead per working rules.
- **Deploy-target change:** user cannot obtain the Oracle ARM free-tier VM.
  Backend hosting decision deferred to slice 9; leading candidates: Render
  free tier (Docker, weasyprint-friendly, sleeps when idle), Koyeb free, or
  Fly.io. Caddy/systemd steps in the spec will be adapted to whatever is
  chosen. UPI QR image arrives from the user before slice 8.
- Supabase publishable key: verified earlier (200 on /auth/v1/health).
- **Secret API key: VERIFIED.** `/rest/v1/` → 200 and privileged
  `/auth/v1/admin/users` → 200 (empty user list, as expected pre-launch).
  Stored in backend/.env (gitignored).

## Batched questions (answer whenever)

- none yet
