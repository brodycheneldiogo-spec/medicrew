-- MediCrew hardening pass.
-- Regulated professional identity is verification-controlled; mission publication is one-way; document access is admin-controlled.

-- mission_requirements originally had no uniqueness constraint for skill rows.
-- Remove accidental duplicates before adding the constraint required by the helper RPC.
delete from public.mission_requirements a
using public.mission_requirements b
where a.id > b.id
  and a.mission_id = b.mission_id
  and a.skill_id is not null
  and a.skill_id = b.skill_id;

create unique index if not exists mission_requirements_mission_skill_uidx
  on public.mission_requirements(mission_id,skill_id)
  where skill_id is not null;

-- Professionals may edit contact/availability fields, but regulated identity fields cannot be changed directly.
create or replace function public.guard_professional_regulated_fields()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if auth.uid() is not null
     and not exists(select 1 from public.profiles where id=auth.uid() and role='admin')
     and (
       new.professional_type is distinct from old.professional_type or
       new.specialty is distinct from old.specialty or
       new.rpps_number is distinct from old.rpps_number or
       new.years_experience is distinct from old.years_experience or
       new.medical_transport_years is distinct from old.medical_transport_years or
       new.air_ambulance_years is distinct from old.air_ambulance_years or
       new.repatriation_years is distinct from old.repatriation_years or
       new.emergency_years is distinct from old.emergency_years or
       new.icu_years is distinct from old.icu_years
     ) then
    raise exception 'Regulated professional credentials require MediCrew verification';
  end if;
  return new;
end;
$$;

drop trigger if exists professional_regulated_fields_guard on public.professionals;
create trigger professional_regulated_fields_guard
before update on public.professionals
for each row execute function public.guard_professional_regulated_fields();

-- Keep the legacy profile RPC safe: its old regulated parameters are retained for API compatibility,
-- but only non-regulated fields are written by a professional.
create or replace function public.update_my_professional_profile(
  p_first_name text,p_last_name text,p_phone text,p_date_of_birth date,p_address text,p_nationality text,
  p_specialty text,p_rpps_number text,p_years_experience integer,p_medical_transport_years numeric,
  p_air_ambulance_years numeric,p_repatriation_years numeric,p_emergency_years numeric,p_icu_years numeric,
  p_international_available boolean,p_available_now boolean
) returns void
language plpgsql security definer set search_path=public
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not exists(select 1 from public.professionals where id=auth.uid()) then raise exception 'Professional profile not found'; end if;
  update public.profiles
    set first_name=nullif(trim(p_first_name),''),last_name=nullif(trim(p_last_name),''),phone=nullif(trim(p_phone),'')
    where id=auth.uid();
  update public.professionals
    set date_of_birth=p_date_of_birth,
        address=nullif(trim(p_address),''),
        nationality=nullif(trim(p_nationality),''),
        international_available=coalesce(p_international_available,false),
        available_now=coalesce(p_available_now,false)
    where id=auth.uid();
end;
$$;
revoke all on function public.update_my_professional_profile(text,text,text,date,text,text,text,text,integer,numeric,numeric,numeric,numeric,numeric,boolean,boolean) from public;
grant execute on function public.update_my_professional_profile(text,text,text,date,text,text,text,text,integer,numeric,numeric,numeric,numeric,numeric,boolean,boolean) to authenticated;

-- A mission can only be published once from draft. It must belong to a verified company and have requirements.
create or replace function public.publish_mission(p_mission_id uuid)
returns integer
language plpgsql security definer set search_path=public
as $$
declare v_company_id uuid; v_status public.mission_status; v_departure timestamptz; v_count integer;
begin
  select company_id,status,departure_at into v_company_id,v_status,v_departure from public.missions where id=p_mission_id for update;
  if v_company_id is null then raise exception 'Mission not found'; end if;
  if v_company_id<>auth.uid() then raise exception 'Not authorized to publish this mission'; end if;
  if v_status<>'draft' then raise exception 'Only draft missions can be published'; end if;
  if v_departure<=now() then raise exception 'Mission departure must be in the future'; end if;
  if not exists(select 1 from public.companies where id=v_company_id and verification_status='verified') then raise exception 'Company verification required'; end if;
  if not exists(select 1 from public.mission_requirements where mission_id=p_mission_id) then raise exception 'At least one mission requirement is required'; end if;

  update public.missions set status='matching',updated_at=now() where id=p_mission_id;
  delete from public.mission_matches where mission_id=p_mission_id;

  insert into public.mission_matches(mission_id,professional_id,score,eligible,reasons)
  select m.id,p.id,
    round((
      case when p.verification_status='verified' then 25 else 0 end
      + case when p.professional_type=m.professional_type then 20 else 0 end
      + case when coalesce((select count(*) from public.mission_requirements r where r.mission_id=m.id and r.kind='mandatory'),0)=0 then 20 else 20.0*(select count(*) from public.mission_requirements r where r.mission_id=m.id and r.kind='mandatory' and ((r.skill_id is not null and exists(select 1 from public.professional_skills ps where ps.professional_id=p.id and ps.skill_id=r.skill_id and ps.verified and (r.minimum_level is null or public.level_rank(ps.experience_level)>=public.level_rank(r.minimum_level)) and (r.minimum_years is null or ps.years_experience>=r.minimum_years))) or (r.language_code is not null and exists(select 1 from public.professional_languages pl where pl.professional_id=p.id and pl.language_code=r.language_code and (r.minimum_level is null or public.level_rank(pl.proficiency)>=public.level_rank(r.minimum_level))))))/nullif((select count(*) from public.mission_requirements r where r.mission_id=m.id and r.kind='mandatory'),0) end
      + case when coalesce((select count(*) from public.mission_requirements r where r.mission_id=m.id and r.kind='preferred'),0)=0 then 15 else 15.0*(select count(*) from public.mission_requirements r where r.mission_id=m.id and r.kind='preferred' and ((r.skill_id is not null and exists(select 1 from public.professional_skills ps where ps.professional_id=p.id and ps.skill_id=r.skill_id and ps.verified and (r.minimum_level is null or public.level_rank(ps.experience_level)>=public.level_rank(r.minimum_level)) and (r.minimum_years is null or ps.years_experience>=r.minimum_years))) or (r.language_code is not null and exists(select 1 from public.professional_languages pl where pl.professional_id=p.id and pl.language_code=r.language_code and (r.minimum_level is null or public.level_rank(pl.proficiency)>=public.level_rank(r.minimum_level))))))/nullif((select count(*) from public.mission_requirements r where r.mission_id=m.id and r.kind='preferred'),0) end
      + case when exists(select 1 from public.professional_availability a where a.professional_id=p.id and a.starts_at<=m.departure_at and a.ends_at>=m.departure_at) then 20 else 0 end
    )::numeric,2),
    p.verification_status='verified'
    and p.professional_type=m.professional_type
    and not exists(select 1 from public.mission_requirements r where r.mission_id=m.id and r.kind='mandatory' and not ((r.skill_id is not null and exists(select 1 from public.professional_skills ps where ps.professional_id=p.id and ps.skill_id=r.skill_id and ps.verified and (r.minimum_level is null or public.level_rank(ps.experience_level)>=public.level_rank(r.minimum_level)) and (r.minimum_years is null or ps.years_experience>=r.minimum_years))) or (r.language_code is not null and exists(select 1 from public.professional_languages pl where pl.professional_id=p.id and pl.language_code=r.language_code and (r.minimum_level is null or public.level_rank(pl.proficiency)>=public.level_rank(r.minimum_level))))))
    and exists(select 1 from public.professional_availability a where a.professional_id=p.id and a.starts_at<=m.departure_at and a.ends_at>=m.departure_at),
    array_remove(array[
      case when p.verification_status='verified' then 'Verified professional' else 'Verification required' end,
      case when p.professional_type=m.professional_type then 'Profession matches' else 'Profession mismatch' end,
      case when exists(select 1 from public.professional_availability a where a.professional_id=p.id and a.starts_at<=m.departure_at and a.ends_at>=m.departure_at) then 'Available at departure' else 'Availability not confirmed' end
    ],null)
  from public.missions m join public.professionals p on true where m.id=p_mission_id;

  select count(*) into v_count from public.mission_matches where mission_id=p_mission_id and eligible;
  return v_count;
end;
$$;
revoke all on function public.publish_mission(uuid) from public;
grant execute on function public.publish_mission(uuid) to authenticated;

-- Verification documents are submitted by professionals but their status is admin-controlled.
drop policy if exists "professional documents self update" on public.professional_documents;
drop policy if exists "professional documents self delete" on public.professional_documents;
drop policy if exists professional_documents_owner_update on public.professional_documents;
drop policy if exists professional_documents_owner_delete on public.professional_documents;

create policy professional_documents_owner_select
on public.professional_documents for select to authenticated
using ((select auth.uid())=professional_id);
create policy professional_documents_owner_insert
on public.professional_documents for insert to authenticated
with check ((select auth.uid())=professional_id);

-- Notification writes and reads are mediated by owner-scoped policies/RPCs.
alter table public.notifications enable row level security;
drop policy if exists notifications_select_own on public.notifications;
drop policy if exists notifications_update_own on public.notifications;
create policy notifications_select_own on public.notifications for select to authenticated using ((select auth.uid())=profile_id);
create policy notifications_update_own on public.notifications for update to authenticated using ((select auth.uid())=profile_id) with check ((select auth.uid())=profile_id);

-- Never expose verification decisions through arbitrary function execution.
revoke all on function public.admin_list_pending_documents() from public;
revoke all on function public.admin_set_document_status(uuid,public.document_status,text) from public;
grant execute on function public.admin_list_pending_documents() to authenticated;
grant execute on function public.admin_set_document_status(uuid,public.document_status,text) to authenticated;
