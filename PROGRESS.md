# PROGRESS

Single source of truth for build status. A fresh session should be able to
resume from this file alone.

## Phase status

- [x] Phase 1 — requirements collection (partial by user choice: repo first,
      Supabase/Google/Vercel being created by user now; Gemini key held by user;
      Oracle VM, domain, UPI QR, Razorpay deferred)
- [x] Phase 2 — repo + CI/CD scaffold. GitHub Actions green; frontend live at
      https://resumelabai.vercel.app; push-to-redeploy verified.
- [x] Phase 3 — slices 1–9 code COMPLETE; backend + frontend deployed.
      Decisions: backend deploys to Render free tier (Oracle swap later);
      Razorpay preferred for payments, finalized at slice 8.
      All credentials verified; Gemini key in backend/.env (mock mode still
      on — real calls need one-time user approval).

## Slice status

| Slice | Status | Gate evidence |
|---|---|---|
| 1 Scaffold (auth, RLS, CI) | **DONE** | BUILDLOG "Slice 1": 12/12 RLS gate checks, CI green, prod redirect verified |
| 2 Upload + parse | **DONE** | BUILDLOG "Slice 2": 27 tests incl. fidelity on 3 fixtures, dedup zero-cost proof |
| 3 Wizard | **DONE** | BUILDLOG "Slice 3": 34 tests, cap/redundancy/impact-order proofs, LLM cannot inject questions |
| 4 Rewrite + render | **DONE** | BUILDLOG "Slice 4": 44 tests — 1 page, ≥95% parse-back, zero unsourced facts, lying-LLM rejection |
| 5 Scorer | **DONE** | BUILDLOG "Slice 5": 52 tests — high/low separation with stated reasons, draft refusal |
| 6 Score repair | **DONE** | BUILDLOG "Slice 6": 59 tests — number gap→question proof, one-line patch isolation, vision normalization |
| 7 JD enhancer | **DONE** | BUILDLOG "Slice 7": 71 tests — zero-new-facts property, full access-chain proof, atomic RPC live |
| 8 Billing | **DONE** (Razorpay keys + UPI QR arrive at deploy) | BUILDLOG "Slice 8": 77 tests + live-DB exactly-once grant proof |
| 9 Outcomes + deploy | **DONE** — E2E 14/14, Render live, Vercel wired | BUILDLOG "Slice 9" |

## Deploy status

- [x] Supabase auth URLs configured (Site URL + 2 redirect URLs, 2026-07-21)
- [x] Frontend on Vercel: https://resumelabai.vercel.app (live, prod 200)
- [x] Render backend: https://resumelab-api.onrender.com (health OK, 2026-07-21)
- [x] NEXT_PUBLIC_API_URL on Vercel: set to https://resumelab-api.onrender.com, prod redeployed
- [ ] Two-account Google sign-in audit
- [ ] Real Gemini approval (one-time)
- [ ] Razorpay keys (when account ready)
- [ ] UPI QR image URL (when user shares)

## Decisions made

- Repo: `resumelab`, private, monorepo (frontend/, backend/, supabase/).
- Local Python is 3.12 (3.11 not installed on dev machine); CI and the Docker
  image pin 3.11, which is authoritative per spec. Local deviation noted.
- Supabase CLI vendored as npm dev dependency (`npx supabase`), not global.
- Docker not installed locally; ARM image will be built on the Oracle VM.
