# ResumeLab Web

A web app that turns the local resume-lab pipeline into a product. Core promise:
a **truthful, ATS-strong resume**. No invented facts, metrics, employers, or
achievements — ever.

## Modes

1. **Resume Lab** — upload → parse → intake wizard → rewrite → PDF/DOCX → ATS score
2. **Score Repair** — paste external feedback → targeted patches, re-score
3. **JD Enhancer** — tailor a FINAL resume to a job description (metered feature)
4. **Outcomes** — track where each version was sent and what happened

## Layout

```
frontend/   Next.js 14 + Tailwind (Vercel)
backend/    FastAPI, Python 3.11 (Docker on Oracle ARM VM behind Caddy)
  llm/      the ONE LLM gateway (cache, tiering, budgets, usage logging)
supabase/   migrations (Postgres + RLS), seed data
```

## Development

```bash
# frontend
cd frontend && npm install && npm run dev

# backend
cd backend && python -m venv .venv && .venv/Scripts/pip install -r requirements.txt
.venv/Scripts/python -m uvicorn app.main:app --reload

# tests (always mock gateway — no real LLM calls in dev/CI)
.venv/Scripts/python -m pytest
```

See `CLAUDE.md` for the full spec, `PROGRESS.md` for build status, and
`BUILDLOG.md` for gate evidence.
