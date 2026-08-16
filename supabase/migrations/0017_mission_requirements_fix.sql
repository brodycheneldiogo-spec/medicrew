-- Mission requirements hardening using the existing schema.
-- Adds clinical/operational requirement categories without patient data.
alter table public.mission_requirements
  add column if not exists kind text not null default 'skill';

alter table public.mission_requirements
  add constraint mission_requirements_kind_check
  check (kind in ('skill','language','experience','transport'));

create index if not exists mission_requirements_kind_idx
  on public.mission_requirements(mission_id, kind);

-- Keep requirement writes company-scoped and validate referenced skills.
create or replace function public.upsert_mission_skill_requirement(
  p_mission_id uuid,
  p_skill_slug text,
  p_required boolean default true,
  p_minimum_level public.experience_level default 'basic',
  p_minimum_years numeric default 0
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_skill uuid;
  v_id uuid;
begin
  if not exists (
    select 1 from public.missions
    where id = p_mission_id and company_id = auth.uid()
  ) then
    raise exception 'Mission not found or unavailable';
  end if;

  select id into v_skill
  from public.skills
  where slug = lower(trim(p_skill_slug));

  if v_skill is null then
    raise exception 'Unknown skill: %', p_skill_slug;
  end if;

  insert into public.mission_requirements (
    mission_id, kind, skill_id, required, minimum_level, minimum_years
  ) values (
    p_mission_id, 'skill', v_skill, p_required,
    p_minimum_level, greatest(coalesce(p_minimum_years, 0), 0)
  )
  on conflict (mission_id, kind, skill_id)
  do update set
    required = excluded.required,
    minimum_level = excluded.minimum_level,
    minimum_years = excluded.minimum_years
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.upsert_mission_skill_requirement(uuid,text,boolean,public.experience_level,numeric) from public;
grant execute on function public.upsert_mission_skill_requirement(uuid,text,boolean,public.experience_level,numeric) to authenticated;
