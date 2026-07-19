-- ResumeLab initial schema. Every table is RLS-scoped to the owning user.
-- Service role (server) bypasses RLS; the anon/browser key never does.

-- ---------------------------------------------------------------- profiles
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  is_free_user boolean not null default false,
  credits int not null default 0 check (credits >= 0),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "own profile read" on public.profiles
  for select using (auth.uid () = id);
create policy "own profile update" on public.profiles
  for update using (auth.uid () = id)
  with check (
    auth.uid () = id
    -- users may edit their display fields, never their own billing state
    and is_free_user = (select p.is_free_user from public.profiles p where p.id = auth.uid ())
    and credits = (select p.credits from public.profiles p where p.id = auth.uid ())
  );

-- Auto-create a profile row from Google metadata on signup.
create function public.handle_new_user ()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.email, ''),
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user ();

-- ----------------------------------------------------------------- resumes
create table public.resumes (
  id uuid primary key default gen_random_uuid (),
  user_id uuid not null references public.profiles (id) on delete cascade,
  file_hash text not null,
  filename text not null,
  parsed_json jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, file_hash)
);

alter table public.resumes enable row level security;
create policy "own resumes" on public.resumes
  for all using (auth.uid () = user_id) with check (auth.uid () = user_id);

-- ---------------------------------------------------------------- versions
create table public.versions (
  id uuid primary key default gen_random_uuid (),
  resume_id uuid not null references public.resumes (id) on delete cascade,
  structure_id text not null,
  markdown text not null default '',
  status text not null default 'draft' check (status in ('draft', 'final')),
  created_at timestamptz not null default now()
);

alter table public.versions enable row level security;
create policy "own versions" on public.versions
  for all using (
    exists (
      select 1 from public.resumes r
      where r.id = resume_id and r.user_id = auth.uid ()
    )
  )
  with check (
    exists (
      select 1 from public.resumes r
      where r.id = resume_id and r.user_id = auth.uid ()
    )
  );

-- Ownership helper for tables hanging off versions.
create function public.owns_version (v_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.versions v
    join public.resumes r on r.id = v.resume_id
    where v.id = v_id and r.user_id = auth.uid ()
  );
$$;

-- ----------------------------------------------------------------- answers
create table public.answers (
  id uuid primary key default gen_random_uuid (),
  version_id uuid not null references public.versions (id) on delete cascade,
  question text not null,
  answer text not null,
  created_at timestamptz not null default now()
);

alter table public.answers enable row level security;
create policy "own answers" on public.answers
  for all using (public.owns_version (version_id))
  with check (public.owns_version (version_id));

-- ------------------------------------------------------------------ scores
create table public.scores (
  id uuid primary key default gen_random_uuid (),
  version_id uuid not null references public.versions (id) on delete cascade,
  source text not null check (source in ('internal', 'external')),
  value int not null check (value between 0 and 100),
  findings_json jsonb,
  created_at timestamptz not null default now()
);

alter table public.scores enable row level security;
create policy "own scores" on public.scores
  for all using (public.owns_version (version_id))
  with check (public.owns_version (version_id));

-- ---------------------------------------------------------------- outcomes
create table public.outcomes (
  id uuid primary key default gen_random_uuid (),
  version_id uuid not null references public.versions (id) on delete cascade,
  sent_to text not null,
  sent_date date not null,
  result text not null default 'pending' check (result in ('call', 'no_call', 'pending')),
  created_at timestamptz not null default now()
);

alter table public.outcomes enable row level security;
create policy "own outcomes" on public.outcomes
  for all using (public.owns_version (version_id))
  with check (public.owns_version (version_id));

-- --------------------------------------------------------------- llm_usage
-- Written only by the server (service role). Users may read their own rows.
create table public.llm_usage (
  id uuid primary key default gen_random_uuid (),
  user_id uuid not null references public.profiles (id) on delete cascade,
  task text not null,
  model text not null,
  tokens_in int not null default 0,
  tokens_out int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.llm_usage enable row level security;
create policy "own usage read" on public.llm_usage
  for select using (auth.uid () = user_id);

-- ---------------------------------------------------------------- payments
-- Users create pending rows (UPI reference submission) and read their own.
-- Only the admin/service role approves; a trigger grants credits exactly once.
create table public.payments (
  id uuid primary key default gen_random_uuid (),
  user_id uuid not null references public.profiles (id) on delete cascade,
  provider text not null check (provider in ('razorpay', 'upi_manual')),
  amount_inr int not null check (amount_inr > 0),
  credits_granted int not null check (credits_granted > 0),
  status text not null default 'pending' check (status in ('pending', 'approved', 'failed')),
  provider_ref text unique,
  created_at timestamptz not null default now()
);

alter table public.payments enable row level security;
create policy "own payments read" on public.payments
  for select using (auth.uid () = user_id);
create policy "own payments insert pending" on public.payments
  for insert with check (auth.uid () = user_id and status = 'pending');

-- Grant credits when a payment flips pending -> approved. The status guard
-- makes a duplicate approval (or webhook retry) a no-op: once approved, the
-- row can't transition again.
create function public.grant_credits_on_approval ()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status = 'pending' and new.status = 'approved' then
    update public.profiles
    set credits = credits + new.credits_granted
    where id = new.user_id;
  end if;
  return new;
end;
$$;

create trigger on_payment_approved
  after update of status on public.payments
  for each row execute function public.grant_credits_on_approval ();

-- ----------------------------------------------------------------- storage
-- Private bucket for uploaded resumes, path-scoped per user: <uid>/<file>
insert into storage.buckets (id, name, public)
values ('resumes', 'resumes', false);

create policy "own resume files read" on storage.objects
  for select using (
    bucket_id = 'resumes' and (storage.foldername (name))[1] = auth.uid ()::text
  );
create policy "own resume files write" on storage.objects
  for insert with check (
    bucket_id = 'resumes' and (storage.foldername (name))[1] = auth.uid ()::text
  );
create policy "own resume files delete" on storage.objects
  for delete using (
    bucket_id = 'resumes' and (storage.foldername (name))[1] = auth.uid ()::text
  );
