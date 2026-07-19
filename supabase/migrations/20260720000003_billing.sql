-- Atomic JD-credit spend: decrement + usage row in ONE transaction.
-- Credits are a ledger: no balance ever changes without a row explaining it.
create function public.use_jd_credit (p_user uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  spent boolean;
begin
  update public.profiles
  set credits = credits - 1
  where id = p_user and credits > 0
  returning true into spent;

  if spent is null then
    return false;  -- zero balance: caller shows the paywall, never an error
  end if;

  insert into public.llm_usage (user_id, task, model, tokens_in, tokens_out)
  values (p_user, 'jd_enhance_run', 'credit', 0, 0);
  return true;
end;
$$;

-- Only the server may call it.
revoke execute on function public.use_jd_credit (uuid) from public, anon, authenticated;
