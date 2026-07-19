# PROGRESS

Single source of truth for build status. A fresh session should be able to
resume from this file alone.

## Phase status

- [x] Phase 1 — requirements collection (partial by user choice: repo first,
      Supabase/Google/Vercel being created by user now; Gemini key held by user;
      Oracle VM, domain, UPI QR, Razorpay deferred)
- [x] Phase 2 — repo + CI/CD scaffold. GitHub Actions green; frontend live at
      https://resumelabai.vercel.app (user linked Vercel). Push-to-redeploy
      verified — see BUILDLOG. Awaiting user's explicit "CI/CD confirmed" to
      start Phase 3.
- [ ] Phase 3 — slices 1–9

## Slice status

| Slice | Status | Gate evidence |
|---|---|---|
| 1 Scaffold (auth, RLS, CI) | scaffold committed; OAuth wiring pending user's Supabase project | — |
| 2 Upload + parse | not started | — |
| 3 Wizard | not started | — |
| 4 Rewrite + render | not started | — |
| 5 Scorer | not started | — |
| 6 Score repair | not started | — |
| 7 JD enhancer | not started | — |
| 8 Billing | not started | — |
| 9 Outcomes + deploy | not started | — |

## Decisions made

- Repo: `resumelab`, private, monorepo (frontend/, backend/, supabase/).
- Local Python is 3.12 (3.11 not installed on dev machine); CI and the Docker
  image pin 3.11, which is authoritative per spec. Local deviation noted.
- Supabase CLI vendored as npm dev dependency (`npx supabase`), not global.
- Docker not installed locally; ARM image will be built on the Oracle VM.

## Pending from user

- Supabase project URL + anon + service role keys; access token for CLI
- Google OAuth client wired into Supabase Auth
- Second Google account for the RLS gate
- Values: DAILY_TOKEN_CAP_USER/GLOBAL (proposed 150k/2M), FREE_JD_RUNS (2),
  JD_CREDIT_PRICE_INR; payments v1-only vs v1+v2
- Later: Gemini key (user has it), Oracle VM, API domain, UPI QR image
