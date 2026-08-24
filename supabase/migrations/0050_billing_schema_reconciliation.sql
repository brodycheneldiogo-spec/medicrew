-- Reconcile billing schema when migration 0046 is already recorded remotely
-- but its objects are missing from the database.
create table if not exists public.company_billing_acceptances (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.missions(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  terms_version text not null,
  professional_fee_cents bigint not null check(professional_fee_cents >= 0),
  service_fee_bps integer not null check(service_fee_bps >= 0 and service_fee_bps <= 5000),
  service_fee_cents bigint not null check(service_fee_cents >= 0),
  accepted_at timestamptz not null default now(),
  unique(mission_id)
);

alter table public.company_billing_acceptances enable row level security;
drop policy if exists company_billing_acceptances_company_read on public.company_billing_acceptances;
drop policy if exists company_billing_acceptances_company_insert on public.company_billing_acceptances;
drop policy if exists company_billing_acceptances_admin_read on public.company_billing_acceptances;
create policy company_billing_acceptances_company_read on public.company_billing_acceptances for select to authenticated using(company_id=auth.uid());
create policy company_billing_acceptances_company_insert on public.company_billing_acceptances for insert to authenticated with check(company_id=auth.uid());
create policy company_billing_acceptances_admin_read on public.company_billing_acceptances for select to authenticated using(exists(select 1 from public.profiles where id=auth.uid() and role='admin'));

-- Legal-version gate moved here so there is no local migration that must be
-- inserted before the already-applied remote migration history.
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

