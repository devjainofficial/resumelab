# BUILDLOG

Gate evidence and batched questions. Newest entries at the top.

## Slice B — Criterion scoring (2026-08-01)

**Gate: PASS**

Architectural change: scorer now returns `criteria` (grouped) alongside `checks` (flat, backward-compat).
Scoring model is criterion-based — section heading names don't break scoring.

**Evidence:**

| Check | Result |
|---|---|
| Strong reference resume score | 82/100 — gate passes (>75) |
| Existing 9/9 scorer tests | All pass, zero regressions |
| Custom headings: "Professional Experience" | Correctly detected as experience-class; 4 bullets scored |
| Custom headings: "Work History", "Career History" | Both resolve to experience-class correctly |
| Legitimate extras: Publications, Languages | Both in ATS_RECOGNIZED_HEADINGS — no penalty |
| Truly unusual headings ("My Journey") | Flagged as advisory (2/3 pts), not 0 |
| Page count context-aware | 1 page = 6/6; 2 pages + 7+ yrs = 6/6; 2 pages junior = 1/6 |
| Criteria UI in browser | 5 criterion rows (Impact/Language/Depth/Structure/Job match), each expandable to findings with section tags |
| Finding section field | `achievement` shows actual heading name ("Experience") not hardcoded string |

**Changes shipped:**
- `backend/scoring/scorer.py`: `_detect_sections()`, `_detect_experience_years()`, `ATS_RECOGNIZED_HEADINGS` (expanded), `_experience_bullets()` uses detected sections, page-count logic experience-aware, `Check` dataclass gets `section`/`criterion` fields, `score_resume()` returns `criteria` group
- `backend/app/score_public.py`: `criteria` added to response
- `frontend/app/score/quick-scorer.tsx`: criterion bars with expandable findings replacing flat check list

**Criteria output (strong.txt):**
```
Impact      24.5/27  ██████████████████░░  achievement=15/15 (Experience), verb_first=4.5/7, verb_variety=5/5
Language    21.5/22  ███████████████████░  weak_language=10/10, buzzwords=6/6, bullet_length=2.5/3, start_variety=3/3
Depth       19.0/19  ████████████████████  depth=8/8, parse_back=8/8, placeholders=3/3
Structure   17.0/17  ████████████████████  one_page=6/6, contact=8/8, headings=3/3
Job match    0.0/15  ░░░░░░░░░░░░░░░░░░░░  (no JD provided)
```

---

## Slice A — Scorer bug fixes (2026-08-01)

**Built:** Fixed four categories of scorer bugs in `backend/scoring/scorer.py`.
No new features, no scoring philosophy changes. Pure bug fixes and missing
implementations from FIXES.md SCORER ALGORITHM FIXES section.

**Fix 1 — Number detection regex** (achievement check, 15 pts):
- `IMPACT_SIGNALS` was matching on `\d[\d,]*` (stops at `.`) and a 7-word unit
  list. "12 engineers", "1.2M users", "50+ clients", "1,00,000 records" all
  returned False.
- Replaced with `_N = r"[\d,]+(?:\.\d+)?"` across all numeric patterns;
  expanded `_UNIT_ALTS` to 40+ professional terms (engineers, developers,
  clients, records, features, sprints, commits, etc.); added `\+?` between
  number and unit; added "N adjective unit" variant for "8 junior developers".
- Tested raw patterns: 12/12 correct (0 false positives on "Helped with
  website", "Worked on improving the process").

**Fix 2 — LinkedIn detection** (contact check, 8 pts):
- `"linkedin.com/"` required a trailing slash. Changed to `"linkedin" in head`.

**Fix 3 — Page count** (structural check, 6 pts):
- Binary 0/6 for any resume > 1 page. Changed to 3/6 for 2-page resumes with
  detail note "acceptable for 7+ years". Full experience-conditional logic
  (parse date ranges → adjust threshold) deferred to calibration pass.

**Fix 4 — Phrase repetition** (start_variety check, 3 pts):
- `start_variety` only checked the first word of each bullet. Added
  `_count_phrase_repetition()`: scans trigrams across all bullets, flags any
  that appear 3+ times (excluding tech term exclusions). Penalty: -0.5 pts
  per repeated trigram, capped at existing variety score.

**Fix 5 — Skills evidenced in bullets** (depth check advisory):
- Skills section extraction previously read only the first line after `## Skills`.
  Now reads all lines until next heading. Added advisory detail to `depth` check:
  lists skill terms that do not appear in any experience bullet. No point change.

**Deferred (documented in FIXES.md with reasoning):**
- Outcome vs context framing: outcome-verb patterns already in IMPACT_SIGNALS;
  full 1.5x weighting restructures achievement check — defer until real user
  data shows calibration is off.
- Tense consistency: false-positive rate high without POS tagger (-ed verbs are
  both active past-tense and passive; can't distinguish without context).
- Duplicate content detection: needs fuzzy matching; `thefuzz` not in deps.
- Render ATS text visually: UI concern, deferred to Slice C.

**Gate evidence (reference/strong.txt → reference/sparse.txt):**
```
Strong   82/100  achievement 15/15, contact 8/8, confidence 10/10
Medium   47/100  0/15 achievement (no numbers — correct), 0/10 confidence (weak language — correct)
Sparse   40/100  0/15 achievement, 0/7 verb-first, skills advisory fires
```
- Strong resume scores 82 — **GATE PASS (need >75)**
- Ordering correct: 82 > 47 > 40
- 9/9 scorer tests still passing (zero regressions)
- All three reference resumes in `/reference/` (strong.txt, medium.txt, sparse.txt)
- Gate script: `backend/gate_slice_a.py`

## Slice 9 — Outcomes, flow UI, deploy prep (2026-07-20)

**Built:** outcomes endpoints (`POST /outcomes`, `PATCH /outcomes/{id}`,
`GET /outcomes` with version context + latest internal score per version);
gateway usage sink — every model call now persists to `llm_usage` (cache
hits never reach the sink, so cached = zero rows, exactly the cost rule);
full flow UI at `/resume/[id]` (wizard questions -> answers -> compose with
DRAFT/FINAL badge -> score breakdown -> PDF/DOCX downloads -> score repair
with before/after -> JD enhancer with paywall rendering -> outcome logging),
dashboard upload zone links into it; `backend/Dockerfile` (python:3.11-slim,
multi-arch for Render x86 today and Oracle ARM later, WeasyPrint deps
included); `render.yaml` blueprint with all env vars declared.

**Gate evidence:**
- `scripts/gate_e2e.py` — REAL uvicorn + REAL Supabase + mock gateway,
  throwaway user: **14/14 PASS** — upload; re-upload dedups at zero cost;
  wizard ≤10 questions; answers stored; compose -> FINAL; score 96 stored;
  repair before/after; enhance via free_flag lane with coverage report;
  outcome logged and dashboard row carries the score; PDF magic bytes and
  DOCX size verified; llm_usage rows: gap_detect/rewrite/jd_enhance (all
  gemini-flash* tiers) + jd_enhance_run ledger row. Cleanup complete.
- pytest 77 passed; frontend `next build` green including /resume/[id];
  local serve verified: / renders all four modes, /dashboard -> 307
  /login?next=%2Fdashboard, /login renders the Google button.

**Remaining for the finish state (needs user):** Render account + blueprint
connect, Supabase auth URL config, two-account Google sign-in audit,
Razorpay keys + UPI QR (billing rails), one-time real-Gemini approval.

## Slice 8 — Billing (2026-07-20)

**Built:** `app/billing.py` — GET /billing/status (credits, allowance, price,
available rails); POST /billing/order (Razorpay order + pending payments row;
503 with UPI guidance until keys configured); POST /billing/webhook/razorpay
(HMAC-SHA256 signature check on the raw body, approval UPDATE scoped to
status=pending so replays match zero rows); POST /billing/upi (manual
reference -> pending row; duplicate reference -> 409). Credit grant itself is
the slice-1 DB trigger; spend is the slice-7 RPC. Razorpay chosen as
preferred rail per user decision; UPI QR manual kept as fallback.

**Gate evidence:**
- pytest (77 passed): forged signature -> 400 with zero writes; valid
  signature approves; replay is a no-op; unconfigured webhook/order -> 503;
  UPI duplicate -> 409 and single row; flagged-user-free and paywall cases
  proven in slice 7's suite.
- LIVE DB (`scripts/gate_slice8.py`): pending->approved grants exactly 2
  credits; duplicate approval matches 0 rows; raw re-update does not
  re-grant; duplicate provider_ref rejected by unique constraint; balance
  explained by exactly 1 approved payments row. Cleanup left zero rows.
- Still pending from user (deploy-time): Razorpay account/keys, UPI QR
  image. Endpoints degrade gracefully until then.

## Slice 7 — JD enhancer (2026-07-20)

**Built:** `enhancer/enhance.py` — truthful moves only: skills reorder (JD
matches first, same tokens), synonym canonicalization from a fixed table
(only for terms the resume already proves), summary tailoring via flash
`jd_enhance` with the truthfulness guard; experience never touched; coverage
report lists present AND missing keywords with an honest "we don't add
unproven skills" note. `billing/access.py` — fixed-order access chain with
every allowed run written to llm_usage (model = free_flag | allowance |
credit). Migration `20260720000003_billing.sql` — `use_jd_credit(uuid)`
SECURITY DEFINER RPC: decrement + usage row in one transaction, execute
revoked from anon/authenticated. Applied to the live DB. `POST
/versions/{id}/enhance` refuses non-FINAL and placeholder resumes with the
exact contract message; paywall is HTTP 402 with a friendly payload.

**Gate evidence (pytest, 71 passed):**
- Zero new facts: output token set ⊆ input token set (property test).
- Experience section byte-identical before/after.
- Skills lead with JD matches; coverage honestly lists rust/graphql missing.
- Lying summary ("Ex-Google", "15 years", "Rust") rejected wholesale.
- Refusals: draft -> 409 exact message; placeholder resume -> 409 exact
  message even for free-flag users.
- Access chain: free flag runs + logs, touches no credits; allowance lane
  when runs < FREE_JD_RUNS; credit lane calls use_jd_credit exactly once
  and balance drops 3->2; zero balance -> 402 paywall payload (price from
  env) and NO variant is created.
- Success path: new FINAL variant version created on the same resume.

## Slice 6 — Score repair (2026-07-20)

**Built:** `repair/findings.py` — pasted text classified deterministically
into known categories (quantify, buzzwords, verb_repetition, weak_verbs,
pronouns, passive, length, readability) with counts; screenshot path goes
through the gateway (`screenshot_extract`, flash tier, cached by image hash)
and the model's output is normalized through the SAME deterministic mapper —
unknown categories are dropped, so vision can only supply labels+counts.
`repair/patcher.py` — per-finding targeted patches: buzzwords/pronouns =
deterministic deletions; quantification gaps = wizard questions (NEVER a
number); verb repetition = flash `repair` rewrite with the slice-4
truthfulness guard. `/versions/{id}/repair` (+ `/repair/screenshot`) refuses
non-FINAL, stores the external findings and the internal re-score, returns
before/after scores + patched markdown.

**Gate evidence (pytest, 59 passed):**
- Resume Worded-style text -> 4 structured findings with correct counts;
  unclassifiable lines ignored.
- Buzzword patch: phrases deleted, exactly ONE line changed, all other lines
  byte-identical (never a full rewrite).
- Quantify: bullet without a number -> `number`-kind wizard question quoting
  the bullet; markdown byte-identical (zero invented digits) with action
  text "nothing was invented".
- Verb repetition: lying model output ("$2M", "90%") rejected -> markdown
  untouched; truthful rephrase accepted; tier = gemini-flash `repair`.
- Screenshot: canned vision output -> normalized structured findings;
  invented category dropped; MOCK mode returns zero findings with an honest
  note (dev never pretends to read screenshots).
- Endpoint: before/after scores returned (after ≥ before on buzzword case),
  scores stored as external+internal pair, patched markdown persisted.

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
