-- MediCrew event missions.
-- Event missions are operational/transport assignments, not patient records.
-- A company publishes an event mission; matching is restricted to verified professionals
-- who are available for the time window and are either in the event country or explicitly
-- available internationally.

alter table public.professionals
  add column if not exists country_of_operation text;

alter table public.missions
  add column if not exists mission_kind text not null default 'transport',
  add column if not exists event_country text,
  add column if not exists event_name text,
  add column if not exists event_venue text,
  add column if not exists event_notes text;

alter table public.missions
  drop constraint if exists missions_mission_kind_check;
alter table public.missions
  add constraint missions_mission_kind_check check (mission_kind in ('transport','event'));

create index if not exists missions_kind_country_idx on public.missions(mission_kind,event_country,departure_at);
create index if not exists professionals_country_idx on public.professionals(country_of_operation);

create or replace function public.publish_event_mission(p_mission_id uuid)
returns integer
language plpgsql
security definer
set search_path=public
as $$
declare
  v_company_id uuid;
  v_country text;
  v_count integer;
begin
  select company_id,event_country into v_company_id,v_country
  from public.missions where id=p_mission_id and mission_kind='event';

  if v_company_id is null or v_company_id<>auth.uid() then
    raise exception 'Not authorized to publish this event mission';
  end if;
  if coalesce(trim(v_country),'')='' then
    raise exception 'Event country is required';
  end if;

  update public.missions set status='matching',updated_at=now() where id=p_mission_id and status in ('draft','published','matching');
  delete from public.mission_matches where mission_id=p_mission_id;

  insert into public.mission_matches(mission_id,professional_id,score,eligible,reasons)
  select m.id,p.id,
    round((
      case when p.verification_status='verified' then 30 else 0 end
      + case when p.professional_type=m.professional_type then 25 else 0 end
      + case when lower(coalesce(p.country_of_operation,''))=lower(m.event_country) then 20 else 0 end
      + case when p.international_available then 10 else 0 end
      + case when exists(select 1 from public.professional_availability a where a.professional_id=p.id and a.starts_at<=m.departure_at and a.ends_at>=m.departure_at) then 15 else 0 end
    )::numeric,2),
    p.verification_status='verified'
      and p.professional_type=m.professional_type
      and exists(select 1 from public.professional_availability a where a.professional_id=p.id and a.starts_at<=m.departure_at and a.ends_at>=m.departure_at)
      and (lower(coalesce(p.country_of_operation,''))=lower(m.event_country) or p.international_available),
    array_remove(array[
      case when p.verification_status='verified' then 'Verified professional' else 'Verification required' end,
      case when p.professional_type=m.professional_type then 'Profession matches' else 'Profession mismatch' end,
      case when lower(coalesce(p.country_of_operation,''))=lower(m.event_country) then 'Located in event country' when p.international_available then 'International availability enabled' else 'Country not eligible' end,
      case when exists(select 1 from public.professional_availability a where a.professional_id=p.id and a.starts_at<=m.departure_at and a.ends_at>=m.departure_at) then 'Available for event time' else 'Availability not confirmed' end
    ],null)
  from public.missions m join public.professionals p on true
  where m.id=p_mission_id;

  insert into public.notifications(profile_id,title,body,type,data)
  select mm.professional_id,
    'New event mission near you',
    left(coalesce(m.event_name,m.title)||' · '||m.event_country||' · '||to_char(m.departure_at at time zone 'UTC','DD/MM/YYYY HH24:MI'),180),
    'event_match',
    jsonb_build_object('mission_id',m.id,'mission_kind','event','score',mm.score)
  from public.mission_matches mm join public.missions m on m.id=mm.mission_id
  where mm.mission_id=p_mission_id and mm.eligible and mm.score>=70;

  select count(*) into v_count from public.mission_matches where mission_id=p_mission_id and eligible;
  return v_count;
end;
$$;

grant execute on function public.publish_event_mission(uuid) to authenticated;

-- This policy may be added after an earlier branch/version already created a similar
-- professional mission policy. Keep this migration idempotent when possible.
drop policy if exists "professional reads event mission fields" on public.missions;
create policy "professional reads event mission fields" on public.missions
for select using (
  mission_kind='event' and status in ('published','matching','professional_selected','confirmed','in_progress','completed')
  and exists(select 1 from public.professionals p where p.id=auth.uid())
);

comment on column public.missions.event_country is 'Country where the event/assignment takes place; ISO-like country name/code supplied by the company.';
comment on column public.professionals.country_of_operation is 'Primary country where the professional is normally based/operates.';
