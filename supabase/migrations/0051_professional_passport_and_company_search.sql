-- Professional passport + company profile search.
-- Passport files remain private verification material. Only nationality and verification state
-- are exposed through the company search RPC; passport numbers are never exposed to companies.

alter table public.professional_documents
  drop constraint if exists professional_documents_document_type_check;

alter table public.professional_documents
  add constraint professional_documents_document_type_check
  check (document_type in ('identity','passport','rpps','cv','rcp_insurance','diploma','certificate','other'));

create index if not exists professional_documents_passport_idx
  on public.professional_documents(professional_id, document_type, status, expires_at);

comment on column public.professionals.nationality is
  'Nationality supplied by the professional and used for legitimate operational/visa matching. It is personal data and must not be used for discriminatory selection.';

create or replace function public.company_search_professionals(
  p_professional_type public.professional_type default null,
  p_nationality text default null,
  p_country_of_operation text default null,
  p_specialty text default null,
  p_min_years_experience integer default null,
  p_international_only boolean default false,
  p_verified_only boolean default true,
  p_limit integer default 50
)
returns table(
  professional_id uuid,
  first_name text,
  last_name text,
  email text,
  avatar_url text,
  professional_type public.professional_type,
  specialty text,
  nationality text,
  country_of_operation text,
  years_experience integer,
  medical_transport_years numeric,
  air_ambulance_years numeric,
  international_available boolean,
  verification_status public.verification_status,
  passport_verified boolean,
  passport_expires_at date
)
language sql
security definer
set search_path=public
stable
as $$
  select
    p.id,
    pr.first_name,
    pr.last_name,
    pr.email,
    pr.avatar_url,
    p.professional_type,
    p.specialty,
    p.nationality,
    p.country_of_operation,
    p.years_experience,
    p.medical_transport_years,
    p.air_ambulance_years,
    p.international_available,
    p.verification_status,
    exists(
      select 1 from public.professional_documents d
      where d.professional_id=p.id
        and d.document_type in ('passport','identity')
        and lower(coalesce(d.title,'')) like '%passport%'
        and d.status='verified'
        and (d.expires_at is null or d.expires_at >= current_date)
    ) as passport_verified,
    (
      select d.expires_at from public.professional_documents d
      where d.professional_id=p.id
        and d.document_type in ('passport','identity')
        and lower(coalesce(d.title,'')) like '%passport%'
        and d.status='verified'
        and (d.expires_at is null or d.expires_at >= current_date)
      order by d.expires_at nulls last, d.created_at desc
      limit 1
    ) as passport_expires_at
  from public.professionals p
  join public.profiles pr on pr.id=p.id
  join public.companies c on c.id=auth.uid()
  where c.verification_status='verified'
    and (not p_verified_only or p.verification_status='verified')
    and (p_professional_type is null or p.professional_type=p_professional_type)
    and (nullif(trim(p_nationality),'') is null or lower(coalesce(p.nationality,''))=lower(trim(p_nationality)))
    and (nullif(trim(p_country_of_operation),'') is null or lower(coalesce(p.country_of_operation,''))=lower(trim(p_country_of_operation)))
    and (nullif(trim(p_specialty),'') is null or lower(coalesce(p.specialty,'')) like '%'||lower(trim(p_specialty))||'%')
    and (p_min_years_experience is null or coalesce(p.years_experience,0) >= greatest(p_min_years_experience,0))
    and (not coalesce(p_international_only,false) or p.international_available)
  order by p.verification_status='verified' desc, p.years_experience desc nulls last, pr.last_name nulls last
  limit least(greatest(coalesce(p_limit,50),1),100);
$$;

revoke all on function public.company_search_professionals(public.professional_type,text,text,text,integer,boolean,boolean,integer) from public;
grant execute on function public.company_search_professionals(public.professional_type,text,text,text,integer,boolean,boolean,integer) to authenticated;

comment on function public.company_search_professionals is
  'Company-only professional directory. Exposes operational profile fields and passport verification state, never passport numbers or document storage paths.';
