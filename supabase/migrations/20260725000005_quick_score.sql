-- Add quick-score columns to resumes so the vault can show a score per upload
-- without requiring a full version/wizard flow.

alter table public.resumes
  add column if not exists quick_score integer,
  add column if not exists quick_score_checks jsonb;
