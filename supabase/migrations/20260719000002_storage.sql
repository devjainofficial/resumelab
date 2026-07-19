-- Private bucket for uploaded resumes, path-scoped per user: <uid>/<file>.
-- Kept separate from the schema migration: storage.* may require elevated
-- rights, and all file access goes through the backend (service role) anyway;
-- these RLS policies are defense in depth for any future direct-client access.
insert into storage.buckets (id, name, public)
values ('resumes', 'resumes', false)
on conflict (id) do nothing;

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
