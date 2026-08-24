-- International company onboarding and stronger professional credential capture.
-- This migration is additive and keeps existing French SIRET/SIREN fields for backwards compatibility.

alter table public.companies
  add column if not exists registration_country text,
  add column if not exists registration_number text,
  add column if not exists registration_authority text,
  add column if not exists vat_number text,
  add column if not exists company_scope text;

alter table public.professionals
  add column if not exists license_number text,
  add column if not exists license_country text,
  add column if not exists license_authority text,
  add column if not exists license_expires_at date,
  add column if not exists specialty text,
  add column if not exists years_experience integer default 0,
  add column if not exists nationality text;

comment on column public.companies.registration_country is 'Country/jurisdiction where the organization is legally registered.';
comment on column public.companies.registration_number is 'Country-specific company/charity/organization registration identifier. SIRET/SIREN remain optional legacy French identifiers.';
comment on column public.companies.company_scope is 'Operational category including transport, assistance, air ambulance, hospital, event medical services or event organization.';
comment on column public.professionals.license_number is 'Professional registration/license number supplied by the applicant; not considered verified until admin evidence review.';
comment on column public.professionals.license_country is 'Jurisdiction of professional registration/license.';
comment on column public.professionals.license_authority is 'Regulatory/professional authority that issued the registration.';

create index if not exists companies_registration_country_idx on public.companies(registration_country);
create index if not exists companies_scope_idx on public.companies(company_scope);
create index if not exists professionals_license_country_idx on public.professionals(license_country);
create index if not exists professionals_nationality_idx on public.professionals(nationality);

-- Never treat self-declared credentials as verified. New/edited professional records stay pending
-- until an authorized admin has reviewed supporting evidence.
create or replace function public.force_professional_pending_on_identity_change()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if tg_op='INSERT' then
    new.verification_status := 'pending';
  elsif new.professional_type is distinct from old.professional_type
     or new.license_number is distinct from old.license_number
     or new.license_country is distinct from old.license_country
     or new.license_authority is distinct from old.license_authority
     or new.specialty is distinct from old.specialty then
    new.verification_status := 'pending';
  end if;
  return new;
end;
$$;

drop trigger if exists professionals_identity_change_requires_review on public.professionals;
create trigger professionals_identity_change_requires_review
before insert or update on public.professionals
for each row execute function public.force_professional_pending_on_identity_change();

