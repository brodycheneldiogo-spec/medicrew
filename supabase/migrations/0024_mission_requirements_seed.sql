-- Reusable mission requirement helper compatible with the deployed mission_requirements schema.
-- requirement_kind is represented by kind; there is no legacy required column.
create or replace function public.set_mission_requirement(
  p_mission_id uuid,
  p_skill_slug text,
  p_required boolean default true,
  p_minimum_level public.experience_level default 'basic',
  p_minimum_years numeric default 0
)
returns uuid
language plpgsql security definer set search_path=public
as $$
declare v_skill uuid; v_id uuid;
begin
  if not exists(select 1 from public.missions where id=p_mission_id and company_id=auth.uid()) then raise exception 'Mission not found or unavailable'; end if;
  select id into v_skill from public.skills where slug=lower(trim(p_skill_slug));
  if v_skill is null then raise exception 'Unknown skill: %',p_skill_slug; end if;
  if p_minimum_years < 0 then raise exception 'Minimum years cannot be negative'; end if;
  insert into public.mission_requirements(mission_id,skill_id,kind,minimum_level,minimum_years)
  values(p_mission_id,v_skill,case when coalesce(p_required,true) then 'mandatory' else 'preferred' end,p_minimum_level,greatest(p_minimum_years,0))
  on conflict(mission_id,skill_id) do update
    set kind=excluded.kind,minimum_level=excluded.minimum_level,minimum_years=excluded.minimum_years
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.set_mission_requirement(uuid,text,boolean,public.experience_level,numeric) from public;
grant execute on function public.set_mission_requirement(uuid,text,boolean,public.experience_level,numeric) to authenticated;
