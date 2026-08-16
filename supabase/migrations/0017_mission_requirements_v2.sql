-- Mission requirements v2: structured operational/clinical requirements for deterministic matching.
create table if not exists public.mission_requirements (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.missions(id) on delete cascade,
  skill_id uuid not null references public.skills(id),
  required boolean not null default true,
  minimum_level public.experience_level not null default 'basic',
  minimum_years numeric not null default 0 check (minimum_years >= 0),
  created_at timestamptz not null default now(),
  unique(mission_id, skill_id)
);

create index if not exists mission_requirements_mission_idx on public.mission_requirements(mission_id);
create index if not exists mission_requirements_skill_idx on public.mission_requirements(skill_id);

alter table public.mission_requirements enable row level security;

-- Companies can manage requirements for their own missions; professionals may only
-- read requirements for missions that are visible to them.
create policy "company manages own mission requirements"
on public.mission_requirements for all
using (exists (
  select 1 from public.missions m
  where m.id = mission_id and m.company_id = auth.uid()
))
with check (exists (
  select 1 from public.missions m
  where m.id = mission_id and m.company_id = auth.uid()
));

create policy "professionals read published requirements"
on public.mission_requirements for select
using (exists (
  select 1 from public.missions m
  where m.id = mission_id and m.status in ('published','matching','confirmed','in_progress','completed')
));

-- Deterministic matching score. Required skills are hard filters; preferred skills
-- contribute to the score. Verification and availability remain hard filters.
create or replace function public.match_professional_to_mission(p_mission_id uuid, p_professional_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.missions%rowtype;
  p public.professionals%rowtype;
  total_required integer := 0;
  matched_required integer := 0;
  total_preferred integer := 0;
  matched_preferred integer := 0;
  skill_match numeric := 0;
  transport_match numeric := 0;
  experience_match numeric := 0;
  score numeric := 0;
  req record;
  ps record;
  candidate_ok boolean := true;
  reasons jsonb := '[]'::jsonb;
  level_rank integer;
  candidate_level_rank integer;
begin
  select * into m from public.missions where id = p_mission_id;
  select * into p from public.professionals where id = p_professional_id;
  if m.id is null or p.id is null then return jsonb_build_object('eligible',false,'score',0,'reasons','[]'::jsonb); end if;

  if p.verification_status <> 'verified' then candidate_ok := false; end if;
  if p.professional_type <> m.professional_type then candidate_ok := false; end if;

  for req in select mr.*, s.name, s.slug from public.mission_requirements mr join public.skills s on s.id=mr.skill_id where mr.mission_id=m.id loop
    if req.required then
      total_required := total_required + 1;
      select ps.* into ps from public.professional_skills ps where ps.professional_id=p.id and ps.skill_id=req.skill_id;
      if ps.professional_id is null then candidate_ok := false; continue; end if;
      select case ps.experience_level when 'basic' then 1 when 'intermediate' then 2 when 'advanced' then 3 when 'expert' then 4 end into candidate_level_rank;
      select case req.minimum_level when 'basic' then 1 when 'intermediate' then 2 when 'advanced' then 3 when 'expert' then 4 end into level_rank;
      if candidate_level_rank >= level_rank and coalesce(ps.years_experience,0) >= req.minimum_years then
        matched_required := matched_required + 1;
      else
        candidate_ok := false;
      end if;
    else
      total_preferred := total_preferred + 1;
      if exists(select 1 from public.professional_skills ps2 where ps2.professional_id=p.id and ps2.skill_id=req.skill_id) then matched_preferred := matched_preferred + 1; end if;
    end if;
  end loop;

  if total_required > 0 then skill_match := matched_required::numeric / total_required; else skill_match := 1; end if;
  if total_preferred > 0 then skill_match := skill_match * 0.8 + (matched_preferred::numeric / total_preferred) * 0.2; end if;
  transport_match := case when coalesce(p.medical_transport_years,0) > 0 then 1 else 0.5 end;
  experience_match := least(coalesce(p.years_experience,0) / 10.0, 1.0);
  score := round((skill_match*70 + transport_match*20 + experience_match*10)::numeric, 1);

  if matched_required = total_required then reasons := reasons || jsonb_build_array('All mandatory skills match'); end if;
  if matched_preferred > 0 then reasons := reasons || jsonb_build_array(format('%s preferred skill%s match',matched_preferred,case when matched_preferred=1 then '' else 's' end)); end if;
  if p.verification_status = 'verified' then reasons := reasons || jsonb_build_array('Verified professional'); end if;

  return jsonb_build_object('eligible',candidate_ok,'score',score,'matched_required',matched_required,'total_required',total_required,'matched_preferred',matched_preferred,'total_preferred',total_preferred,'reasons',reasons);
end;
$$;

revoke all on function public.match_professional_to_mission(uuid,uuid) from public;
