-- Current legal versions after the post-mission invoicing model change.
create or replace function public.has_current_legal_acceptance(p_profile_id uuid default auth.uid())
returns boolean language sql security definer set search_path=public stable as $$
  select exists(
    select 1 from public.legal_acceptances
    where profile_id=p_profile_id
      and terms_version='2.1'
      and privacy_version='1.2'
      and data_policy_version='1.1'
  );
$$;
revoke all on function public.has_current_legal_acceptance(uuid) from public;
grant execute on function public.has_current_legal_acceptance(uuid) to authenticated;

-- B2B billing acceptance is reconciled in migration 0050 because migration 0046
-- is already present in the remote migration history.
