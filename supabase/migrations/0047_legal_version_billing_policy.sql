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

comment on table public.company_billing_acceptances is 'Versioned B2B acceptance of MediCrew service-fee invoicing terms. Professional compensation is paid directly by the company outside MediCrew.';
