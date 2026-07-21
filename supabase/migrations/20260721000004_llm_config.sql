-- LLM provider config: a single-row table the admin edits in the Supabase
-- table editor to switch between providers without a redeploy.
create table if not exists public.llm_config (
  id int primary key default 1 check (id = 1),  -- single-row enforced
  active_provider text not null default 'azure'
    check (active_provider in ('azure', 'gemini')),
  updated_at timestamptz not null default now()
);

insert into public.llm_config (id, active_provider) values (1, 'azure')
on conflict (id) do nothing;

-- No RLS — this is a server-side-only config table read with the service role key.
-- Revoke access from anon/authenticated so it's invisible to the client.
revoke all on public.llm_config from anon, authenticated;
