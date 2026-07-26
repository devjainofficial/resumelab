-- Add is_admin flag to profiles.
-- Flip it in the Supabase table editor to grant admin access.
-- The existing update policy must be replaced to prevent users from
-- self-granting this column through the browser client.

alter table public.profiles
  add column is_admin boolean not null default false;

-- Replace the update policy: lock is_free_user, credits, AND is_admin
-- so none of them can be changed by the user themselves.
drop policy "own profile update" on public.profiles;

create policy "own profile update" on public.profiles
  for update using (auth.uid() = id)
  with check (
    auth.uid() = id
    and is_free_user = (select p.is_free_user from public.profiles p where p.id = auth.uid())
    and credits     = (select p.credits      from public.profiles p where p.id = auth.uid())
    and is_admin    = (select p.is_admin     from public.profiles p where p.id = auth.uid())
  );
