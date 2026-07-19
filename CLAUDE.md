# ResumeLab Web: CLAUDE.md

You are building ResumeLab Web, a web app that productizes the local resume-lab
pipeline. Core promise to users: a truthful, ATS-strong resume. We NEVER invent
facts, metrics, employers, or achievements. Everything else serves that promise.

## Product modes

1. RESUME LAB: upload resume -> parse -> intake wizard (questions) -> rewrite
   using a chosen reference structure -> render PDF + DOCX -> built-in ATS
   score -> download. Output is FINAL only when every needed input is answered;
   otherwise DRAFT, clearly watermarked.
2. SCORE REPAIR: user submits external feedback either as pasted text or
   as screenshots of the Resume Worded results page. A vision pass (Gemini
   flash) extracts the finding categories and counts (e.g. "Quantify
   impact: 6", "Buzzwords: 8") so users don't have to transcribe. Each
   finding maps to a targeted patch: buzzword lists become deterministic
   deletions, quantification gaps become wizard questions, verb repetition
   triggers a rewrite pass. Never a full rewrite. If a finding needs a
   number we don't have, generate a wizard question instead of inventing
   one. Show a before/after score comparison on completion.
3. JD ENHANCER: takes a FINAL resume + a job description. Keyword mirroring
   where truthful, skills reorder, summary tailoring. Never adds experience.
   If the uploaded resume contains placeholder markers or fails parse checks,
   refuse with: "Run this resume through Resume Lab first, then tailor it."
4. OUTCOMES: per version, log where it was sent, date, result (call / no
   call) and every score. This data compounds; it is the long-term moat.

## Stack (locked, do not substitute)

- Frontend: Next.js 14, Tailwind. Backend: FastAPI (Python 3.11).
- Supabase: auth with Google OAuth sign-in; login is required before any
  upload, wizard, or generation. Postgres, storage. RLS on every table,
  keyed by user.
- LLM: Gemini via server-side key only. The key never reaches the client.
- Deterministic Python for parsing, lint scoring, diffing, rendering.
- Rendering: markdown source of truth -> PDF (weasyprint) + DOCX (python-docx).
- Hosting: FastAPI in Docker on the Oracle ARM free-tier VM behind Caddy
  (auto TLS). Frontend on Vercel free tier or the same VM.

## Cost rules (hard, enforce in code)

All LLM traffic goes through ONE gateway module: `llm/gateway.py`. The gateway:
- checks a Supabase cache first, keyed by (task, content hash); identical
  inputs never hit the API twice (same parse-once-cache pattern as the job
  search service)
- tiers models: gemini flash-lite for extraction, gap detection, and question
  generation; flash for rewrites and repairs; nothing larger without an env
  flag
- enforces budgets: per-user daily token cap and a global daily cap from env;
  over budget returns a friendly "come back tomorrow" and never silently
  charges
- logs every call (user, task, tokens in/out, model) to `llm_usage`
- development and tests run against a mock gateway; no real API calls in CI

Deterministic-first is the main cost lever: parsing, ATS lint scoring,
keyword extraction and coverage math, one-page checks, diffs, and rendering
use zero LLM tokens, ever. The LLM only writes and repairs prose.

## No-fabrication contract (product core)

- Facts come only from the user's uploaded resume and their wizard answers.
- A missing number becomes a wizard question, never a guess.
- FINAL requires zero open inputs. DRAFT renders carry a visible watermark
  and a blocked score button.
- Store provenance per fact: parsed-from-upload or user-answered.

## Intake wizard

After parsing, a gap detector (deterministic checks + one flash-lite pass)
builds a question set, hard cap 10 questions, ordered by score impact:
- multiple choice for inferable things: target role level, industry, section
  emphasis, which projects matter most
- short numeric fields for metrics: team size, users, latency, revenue,
  counts, timelines
- every answer is stored as a user-stated fact and reused in later runs
The wizard runs BEFORE the rewrite. No rewrite starts with open critical gaps.

## Reference structure library (seed data, not visual templates)

All structures: single column, standard section headings (Summary, Skills,
Experience, Education; never creative labels), reverse-chronological dates,
10-12pt system font, text-selectable PDF, no tables, text boxes, graphics,
or icons. Structures differ only in section order and emphasis:
- S1 CLASSIC (default, 3+ years experience): Contact, Summary, Skills,
  Experience, Education, Certifications
- S2 TECH PROJECTS-FORWARD (developers with strong side projects): Contact,
  Summary, Skills, Experience, Projects, Education
- S3 FRESHER (0-2 years): Contact, Summary, Education, Projects and
  Internships, Skills
- S4 CAREER-CHANGER HYBRID: Contact, Summary, Core Skills (expanded),
  Experience reverse-chronological, Education. Never build a functional
  (undated) format; ATS platforms penalize or reject undated work entries.
Store each as a JSON spec: section order, bullet rules, density targets,
length limit (one page hard).

## Built-in ATS scorer (deterministic, free)

Port the resume-lab Phase 5 gates to code. Score 0-100 with a per-check
breakdown the user can read:
- parse-back fidelity (extract text from the rendered PDF, compare to source)
- exactly one page; single column; standard headings; contact completeness
  (email, phone, LinkedIn)
- bullet lint: verb-first, 40 words max, verb variety, quantification ratio
  (numbers in at least two thirds of experience bullets)
- keyword coverage vs JD when provided
- zero placeholder markers
Adapt logic from open-source ATS checkers where useful. DRAFTs cannot be
scored. Every score is stored per version in `scores`.

## Supabase schema (initial migration)

- profiles: id (auth uid), email, full_name, avatar_url (all from Google
  metadata), is_free_user boolean default false, credits int default 0,
  created_at. A trigger on auth.users insert auto-creates the profiles row.
- resumes: id, user_id, file_hash, filename, parsed_json, created_at
- versions: id, resume_id, structure_id, markdown, status (draft|final),
  created_at
- answers: id, version_id, question, answer, created_at
- scores: id, version_id, source (internal|external), value, findings_json,
  created_at
- outcomes: id, version_id, sent_to, sent_date, result (call|no_call|pending)
- llm_usage: id, user_id, task, model, tokens_in, tokens_out, created_at
- payments: id, user_id, provider (razorpay|upi_manual), amount_inr,
  credits_granted, status (pending|approved|failed), provider_ref (unique),
  created_at
RLS: every table row scoped to the owning user. Service role key only on the
server. Uploaded files in a private storage bucket, path-scoped per user.

## Billing (JD enhancer only)

Resume lab core, score repair, and outcomes stay free, protected by the token
caps. The JD enhancer is the metered feature. Access check, in this order:
1. profiles.is_free_user = true -> run free, still log usage. The flag is a
   plain boolean the admin flips in the Supabase table editor; no admin UI
   in v1.
2. Free allowance remaining (FREE_JD_RUNS per account, default 2, env
   configurable, can be 0) -> run and count it.
3. credits > 0 -> decrement atomically in the same transaction that records
   the run.
4. Otherwise -> a friendly paywall screen, never an error.

Payment v1 (zero fees, zero setup): show the UPI QR image (UPI_QR_IMAGE_URL)
plus a field where the user submits their UPI transaction reference. That
creates a payments row with status pending. Admin approves it in the Supabase
table editor and a database trigger grants the credits.

Payment v2 (optional, automated): Razorpay checkout or payment link. A
FastAPI webhook endpoint verifies the signature, marks the payments row
approved, and grants credits idempotently via the unique provider_ref, so a
webhook that fires twice can never grant twice.

Credits are a ledger: never mutate a balance without a payments row or a
usage row explaining the change.

## Scoring flow (what the user sees)

After a FINAL is generated, show the built-in ATS score with the breakdown,
then a "Get a second opinion on Resume Worded" link. Below that link, a
prominent "Not happy with the score? Paste the screenshot here" upload area
feeds Score Repair mode directly. Frame this as a single loop, not two
disconnected features. First-run copy for the upload zone: "We've seen
scores jump 65 to 83 from a screenshot alone. Drop yours in."

## Build slices (in order, each ends with a gate the user can verify)

1. SCAFFOLD: repos, envs, Supabase project, migrations, RLS, Google OAuth
   sign-in wired end to end (guide the user through creating the Google
   Cloud OAuth client and pasting keys into Supabase). GATE: two different
   Google accounts sign in, each gets an auto-created profiles row, RLS
   isolates their data, logged-out users are blocked from every feature;
   CI green with mock gateway.
2. UPLOAD + PARSE: pdf/docx to structured JSON, file-hash dedup. GATE: parse
   fidelity on 3 known resumes; re-upload of the same file costs zero tokens.
3. WIZARD: gap detection to question set. GATE: a known sparse resume yields
   sensible, non-redundant questions capped at 10.
4. REWRITE + RENDER: structure spec + facts -> markdown -> PDF + DOCX. GATE:
   one page, parse-back passes, zero unsourced facts (spot-check by diffing
   claims against inputs).
5. SCORER: built-in score with breakdown. GATE: scores a finished resume
   high and a sparse one low for stated reasons; refuses DRAFTs.
6. SCORE REPAIR: paste text or upload a Resume Worded screenshot -> vision
   extraction -> targeted patches only. GATE: a finding needing a number
   produces a question, not a number; a screenshot from Resume Worded is
   correctly parsed into structured findings; before/after scores displayed.
7. JD ENHANCER: FINAL + JD -> tailored variant + coverage report. GATE:
   refuses non-FINAL input; zero new facts introduced; access check enforced
   (free flag bypasses, allowance counts, credits decrement atomically,
   zero balance shows the paywall).
8. BILLING: credits ledger, UPI QR manual flow, optional Razorpay webhook.
   GATE: a flagged user runs free; a duplicate webhook grants credits exactly
   once; a zero-balance user sees the paywall, not an error.
9. OUTCOMES + DASHBOARD, then DEPLOY.

## Deployment (slice 8)

1. Supabase: create cloud project (free tier), `supabase db push` migrations,
   create private bucket, note anon + service keys. Enable the Google
   provider: create an OAuth client in Google Cloud Console, add Supabase's
   callback URL to its authorized redirects, paste client ID and secret into
   Supabase Auth settings, and set the site URL to the production frontend
   domain.
2. Backend: Dockerfile for FastAPI; run on the Oracle ARM VM; Caddy reverse
   proxy with automatic HTTPS; systemd unit for restart on boot.
3. Frontend: Vercel free tier, env pointing at the API domain.
4. Env vars (server only): GEMINI_API_KEY, SUPABASE_URL,
   SUPABASE_SERVICE_ROLE_KEY, DAILY_TOKEN_CAP_USER, DAILY_TOKEN_CAP_GLOBAL,
   FREE_JD_RUNS, JD_CREDIT_PRICE_INR, UPI_QR_IMAGE_URL, and optionally
   RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET.
5. Smoke test: sign up, upload, wizard, render, score, download, and check
   llm_usage shows only tiered, cached calls.

## Working rules for you (Claude Code)

- One slice at a time. Show the gate result before starting the next slice.
- Ask the user before anything that would spend real Gemini tokens in dev.
- Never weaken the cost rules or the no-fabrication contract to pass a gate.
- Keep the resume-lab CLAUDE.md rules as the rewrite engine's spec; the app
  is a wrapper around the same discipline, not a replacement for it.
