-- Require current verified evidence at the point of matching/search and expose international context to admins.

create or replace function public.company_mission_matches(p_mission_id uuid)
returns table(
  match_id uuid,professional_id uuid,first_name text,last_name text,avatar_url text,
  professional_type public.professional_type,specialty text,years_experience integer,
  medical_transport_years numeric,air_ambulance_years numeric,
  verification_status public.verification_status,score numeric,eligible boolean,reasons text[]
)
language sql
security definer
set search_path=public
stable
as $$
  select mm.id,p.id,pr.first_name,pr.last_name,pr.avatar_url,p.professional_type,p.specialty,
         p.years_experience,p.medical_transport_years,p.air_ambulance_years,p.verification_status,
         mm.score,mm.eligible,mm.reasons
  from public.mission_matches mm
  join public.missions m on m.id=mm.mission_id
  join public.professionals p on p.id=mm.professional_id
  join public.profiles pr on pr.id=p.id
  where mm.mission_id=p_mission_id
    and m.company_id=auth.uid()
    and mm.eligible=true
    and public.professional_has_current_launch_evidence(p.id)
  order by mm.score desc;
$$;
revoke all on function public.company_mission_matches(uuid) from public;
grant execute on function public.company_mission_matches(uuid) to authenticated;

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
  professional_id uuid,first_name text,last_name text,email text,avatar_url text,
  professional_type public.professional_type,specialty text,nationality text,country_of_operation text,
  years_experience integer,medical_transport_years numeric,air_ambulance_years numeric,
  international_available boolean,verification_status public.verification_status,
  passport_verified boolean,passport_expires_at date
)
language sql
security definer
set search_path=public
stable
as $$
  select p.id,pr.first_name,pr.last_name,pr.email,pr.avatar_url,p.professional_type,p.specialty,
         p.nationality,p.country_of_operation,p.years_experience,p.medical_transport_years,
         p.air_ambulance_years,p.international_available,p.verification_status,
         exists(
           select 1 from public.professional_documents d
           where d.professional_id=p.id and d.document_type='passport' and d.status='verified'
             and (d.expires_at is null or d.expires_at>=current_date)
         ) as passport_verified,
         (
           select d.expires_at from public.professional_documents d
           where d.professional_id=p.id and d.document_type='passport' and d.status='verified'
             and (d.expires_at is null or d.expires_at>=current_date)
           order by d.expires_at nulls last,d.created_at desc limit 1
         ) as passport_expires_at
  from public.professionals p
  join public.profiles pr on pr.id=p.id
  join public.companies c on c.id=auth.uid()
  where c.verification_status='verified'
    and (not p_verified_only or public.professional_has_current_launch_evidence(p.id))
    and (p_professional_type is null or p.professional_type=p_professional_type)
    and (nullif(trim(p_nationality),'') is null or lower(coalesce(p.nationality,''))=lower(trim(p_nationality)))
    and (nullif(trim(p_country_of_operation),'') is null or lower(coalesce(p.country_of_operation,''))=lower(trim(p_country_of_operation)))
    and (nullif(trim(p_specialty),'') is null or lower(coalesce(p.specialty,'')) like '%'||lower(trim(p_specialty))||'%')
    and (p_min_years_experience is null or coalesce(p.years_experience,0)>=greatest(p_min_years_experience,0))
    and (not coalesce(p_international_only,false) or p.international_available)
  order by public.professional_has_current_launch_evidence(p.id) desc,p.years_experience desc nulls last,pr.last_name nulls last
  limit least(greatest(coalesce(p_limit,50),1),100);
$$;
revoke all on function public.company_search_professionals(public.professional_type,text,text,text,integer,boolean,boolean,integer) from public;
grant execute on function public.company_search_professionals(public.professional_type,text,text,text,integer,boolean,boolean,integer) to authenticated;

create or replace function public.admin_verification_queue()
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare result jsonb;
begin
  if not exists(select 1 from public.profiles where id=auth.uid() and role='admin') then
    raise exception 'Admin access required';
  end if;
  select jsonb_build_object(
    'documents',coalesce((select jsonb_agg(row_to_json(x) order by x.created_at desc) from (
      select d.id,d.professional_id,d.document_type,d.title,d.reference,d.expires_at,d.status,
             d.rejection_reason,d.created_at,d.storage_path,
             pr.first_name,pr.last_name,p.professional_type,p.specialty,p.nationality,
             p.license_number,p.license_country,p.license_authority,p.license_expires_at,p.years_experience
      from public.professional_documents d
      join public.profiles pr on pr.id=d.professional_id
      join public.professionals p on p.id=d.professional_id
      where d.status='pending' or (d.expires_at is not null and d.expires_at<current_date and d.status='verified')
    )x),'[]'::jsonb),
    'certifications',coalesce((select jsonb_agg(row_to_json(y) order by y.created_at desc) from (
      select c.id,c.professional_id,c.name,c.issuer,c.issued_at,c.expires_at,c.status,c.created_at,
             pr.first_name,pr.last_name,p.professional_type,p.license_country,p.license_authority
      from public.professional_certifications c
      join public.profiles pr on pr.id=c.professional_id
      join public.professionals p on p.id=c.professional_id
      where c.status='pending' or (c.expires_at is not null and c.expires_at<current_date and c.status='verified')
    )y),'[]'::jsonb)
  ) into result;
  return result;
end;
$$;
revoke all on function public.admin_verification_queue() from public;
grant execute on function public.admin_verification_queue() to authenticated;

create or replace function public.admin_company_verification_queue()
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare result jsonb;
begin
  if not exists(select 1 from public.profiles where id=auth.uid() and role='admin') then
    raise exception 'Admin access required';
  end if;
  select coalesce(jsonb_agg(row_to_json(x) order by x.created_at desc),'[]'::jsonb) into result
  from(
    select d.id,d.company_id,d.document_type,d.title,d.reference,d.storage_path,d.status,
           d.rejection_reason,d.created_at,c.company_name,c.organization_type,c.company_scope,
           c.registration_country,c.registration_number,c.registration_authority,c.vat_number,c.address,c.contact_name
    from public.company_verification_documents d
    join public.companies c on c.id=d.company_id
    where d.status in('pending','expired')
  )x;
  return jsonb_build_object('documents',result);
end;
$$;
revoke all on function public.admin_company_verification_queue() from public;
grant execute on function public.admin_company_verification_queue() to authenticated;

