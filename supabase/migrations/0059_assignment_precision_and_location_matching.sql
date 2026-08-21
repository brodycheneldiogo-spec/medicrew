-- Precise assignment data and deterministic eligibility. Internal mission_matches.score is retained
-- only for schema compatibility; the product no longer exposes a percentage score.

alter table public.missions
  add column if not exists required_specialty text,
  add column if not exists minimum_experience_years integer default 0,
  add column if not exists required_languages text[] not null default '{}',
  add column if not exists staff_count integer not null default 1,
  add column if not exists event_type text,
  add column if not exists expected_attendance integer,
  add column if not exists on_site_contact text,
  add column if not exists operational_notes text;

alter table public.missions drop constraint if exists missions_min_experience_check;
alter table public.missions add constraint missions_min_experience_check check(coalesce(minimum_experience_years,0)>=0);
alter table public.missions drop constraint if exists missions_staff_count_check;
alter table public.missions add constraint missions_staff_count_check check(staff_count between 1 and 100);

create or replace function public.publish_network_assignment(p_mission_id uuid)
returns integer
language plpgsql security definer set search_path=public
as $$
declare
 v_company public.companies%rowtype;
 v_mission public.missions%rowtype;
 v_count integer;
begin
 select * into v_company from public.companies where id=auth.uid();
 if v_company.id is null or v_company.verification_status<>'verified' then raise exception 'Verified organization required'; end if;
 select * into v_mission from public.missions where id=p_mission_id and company_id=auth.uid();
 if v_mission.id is null then raise exception 'Assignment not found'; end if;
 if (v_company.company_type='transport' and v_mission.mission_kind<>'transport') or (v_company.company_type='event' and v_mission.mission_kind<>'event') then raise exception 'Assignment type does not match organization type'; end if;
 if v_mission.departure_at<=now() then raise exception 'Assignment must be in the future'; end if;
 if v_mission.mission_kind='transport' and (nullif(trim(v_mission.departure_airport_code),'') is null or nullif(trim(v_mission.arrival_airport_code),'') is null) then raise exception 'Departure and arrival airport codes are required'; end if;
 if v_mission.mission_kind='event' and (nullif(trim(v_mission.event_city),'') is null or nullif(trim(v_mission.event_country),'') is null or nullif(trim(v_mission.event_name),'') is null) then raise exception 'Event name, city and country are required'; end if;

 update public.missions set status='matching',transport_type='air',updated_at=now() where id=p_mission_id;
 delete from public.mission_matches where mission_id=p_mission_id;

 insert into public.mission_matches(mission_id,professional_id,score,eligible,reasons)
 select v_mission.id,p.id,100,true,
  array_remove(array[
   'Verified professional',
   'Profession matches',
   'Available on assignment date',
   case when v_mission.mission_kind='transport' then 'Based at departure airport' else 'Based near event location' end,
   case when nullif(trim(v_mission.required_specialty),'') is not null then 'Specialty requirement met' end,
   case when coalesce(v_mission.minimum_experience_years,0)>0 then 'Experience requirement met' end
  ],null)
 from public.professionals p
 where p.verification_status='verified'
   and p.professional_type=v_mission.professional_type
   and coalesce(p.years_experience,0)>=coalesce(v_mission.minimum_experience_years,0)
   and (nullif(trim(v_mission.required_specialty),'') is null or lower(coalesce(p.specialty,'')) like '%'||lower(trim(v_mission.required_specialty))||'%')
   and exists(select 1 from public.professional_available_days d where d.professional_id=p.id and d.available_date=(v_mission.departure_at at time zone 'UTC')::date)
   and (
    (v_mission.mission_kind='transport' and upper(trim(coalesce(p.base_airport_code,'')))=upper(trim(v_mission.departure_airport_code)))
    or
    (v_mission.mission_kind='event' and (lower(trim(coalesce(p.base_city,'')))=lower(trim(v_mission.event_city)) or lower(trim(coalesce(p.country_of_operation,'')))=lower(trim(v_mission.event_country))))
   )
   and exists(select 1 from public.professional_documents d where d.professional_id=p.id and d.document_type='passport' and d.status='verified' and (d.expires_at is null or d.expires_at>=current_date))
   and exists(select 1 from public.professional_documents d where d.professional_id=p.id and d.document_type='rpps' and d.status='verified' and (d.expires_at is null or d.expires_at>=current_date))
   and exists(select 1 from public.professional_documents d where d.professional_id=p.id and d.document_type='diploma' and d.status='verified');

 insert into public.notifications(profile_id,title,body,type,data)
 select mm.professional_id,
  case when v_mission.mission_kind='event' then 'New event assignment near you' else 'New air-medical assignment from your base airport' end,
  left(v_mission.title||' · '||to_char(v_mission.departure_at at time zone 'UTC','DD/MM/YYYY HH24:MI'),180),
  'assignment_available',jsonb_build_object('mission_id',v_mission.id,'mission_kind',v_mission.mission_kind)
 from public.mission_matches mm where mm.mission_id=v_mission.id and mm.eligible;
 select count(*) into v_count from public.mission_matches where mission_id=v_mission.id and eligible;
 return v_count;
end;
$$;
revoke all on function public.publish_network_assignment(uuid) from public;
grant execute on function public.publish_network_assignment(uuid) to authenticated;
