-- MediCrew marketplace workflow: publication, eligibility, matching and safe company-side candidate access.

create or replace function public.level_rank(level public.experience_level)
returns integer language sql immutable as $$
  select case level
    when 'basic' then 1
    when 'intermediate' then 2
    when 'advanced' then 3
    when 'expert' then 4
  end;
$$;

create or replace function public.publish_mission(p_mission_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
  v_count integer;
begin
  select company_id into v_company_id from public.missions where id = p_mission_id;
  if v_company_id is null or v_company_id <> auth.uid() then
    raise exception 'Not authorized to publish this mission';
  end if;

  update public.missions
  set status = 'matching', updated_at = now()
  where id = p_mission_id and status in ('draft','published','matching');

  delete from public.mission_matches where mission_id = p_mission_id;

  insert into public.mission_matches (mission_id, professional_id, score, eligible, reasons)
  select
    m.id,
    p.id,
    round((
      case when p.verification_status = 'verified' then 25 else 0 end
      + case when p.professional_type = m.professional_type then 20 else 0 end
      + case when coalesce((select count(*) from public.mission_requirements r where r.mission_id=m.id and r.kind='mandatory'),0)=0 then 20
             else 20.0 * (select count(*) from public.mission_requirements r where r.mission_id=m.id and r.kind='mandatory' and (
                 (r.skill_id is not null and exists (select 1 from public.professional_skills ps where ps.professional_id=p.id and ps.skill_id=r.skill_id and ps.verified and (r.minimum_level is null or public.level_rank(ps.experience_level) >= public.level_rank(r.minimum_level)) and (r.minimum_years is null or ps.years_experience >= r.minimum_years)))
                 or (r.language_code is not null and exists (select 1 from public.professional_languages pl where pl.professional_id=p.id and pl.language_code=r.language_code and (r.minimum_level is null or public.level_rank(pl.proficiency) >= public.level_rank(r.minimum_level))))
               )) / nullif((select count(*) from public.mission_requirements r where r.mission_id=m.id and r.kind='mandatory'),0) end
      + case when coalesce((select count(*) from public.mission_requirements r where r.mission_id=m.id and r.kind='preferred'),0)=0 then 15
             else 15.0 * (select count(*) from public.mission_requirements r where r.mission_id=m.id and r.kind='preferred' and (
                 (r.skill_id is not null and exists (select 1 from public.professional_skills ps where ps.professional_id=p.id and ps.skill_id=r.skill_id and ps.verified and (r.minimum_level is null or public.level_rank(ps.experience_level) >= public.level_rank(r.minimum_level)) and (r.minimum_years is null or ps.years_experience >= r.minimum_years)))
                 or (r.language_code is not null and exists (select 1 from public.professional_languages pl where pl.professional_id=p.id and pl.language_code=r.language_code and (r.minimum_level is null or public.level_rank(pl.proficiency) >= public.level_rank(r.minimum_level))))
               )) / nullif((select count(*) from public.mission_requirements r where r.mission_id=m.id and r.kind='preferred'),0) end
      + case when exists (select 1 from public.professional_availability a where a.professional_id=p.id and a.starts_at <= m.departure_at and a.ends_at >= m.departure_at) then 20 else 0 end
    )::numeric, 2),
    p.verification_status = 'verified'
      and p.professional_type = m.professional_type
      and not exists (
        select 1 from public.mission_requirements r
        where r.mission_id = m.id and r.kind='mandatory'
        and not (
          (r.skill_id is not null and exists (select 1 from public.professional_skills ps where ps.professional_id=p.id and ps.skill_id=r.skill_id and ps.verified and (r.minimum_level is null or public.level_rank(ps.experience_level) >= public.level_rank(r.minimum_level)) and (r.minimum_years is null or ps.years_experience >= r.minimum_years)))
          or (r.language_code is not null and exists (select 1 from public.professional_languages pl where pl.professional_id=p.id and pl.language_code=r.language_code and (r.minimum_level is null or public.level_rank(pl.proficiency) >= public.level_rank(r.minimum_level))))
        )
      )
      and exists (select 1 from public.professional_availability a where a.professional_id=p.id and a.starts_at <= m.departure_at and a.ends_at >= m.departure_at),
    array_remove(array[
      case when p.verification_status = 'verified' then 'Verified professional' else 'Verification required' end,
      case when p.professional_type = m.professional_type then 'Profession matches' else 'Profession mismatch' end,
      case when exists (select 1 from public.professional_availability a where a.professional_id=p.id and a.starts_at <= m.departure_at and a.ends_at >= m.departure_at) then 'Available at departure' else 'Availability not confirmed' end
    ], null)
  from public.missions m
  join public.professionals p on true
  where m.id = p_mission_id;

  select count(*) into v_count from public.mission_matches where mission_id = p_mission_id and eligible;
  return v_count;
end;
$$;

grant execute on function public.publish_mission(uuid) to authenticated;

grant execute on function public.level_rank(public.experience_level) to authenticated;

-- Companies can see only safe candidate data for their own missions.
create or replace function public.company_mission_matches(p_mission_id uuid)
returns table (
  match_id uuid,
  professional_id uuid,
  first_name text,
  last_name text,
  professional_type public.professional_type,
  specialty text,
  years_experience integer,
  medical_transport_years numeric,
  air_ambulance_years numeric,
  verification_status public.verification_status,
  score numeric,
  eligible boolean,
  reasons text[]
)
language sql
security definer
set search_path = public
as $$
  select mm.id, p.id, pr.first_name, pr.last_name, p.professional_type, p.specialty,
         p.years_experience, p.medical_transport_years, p.air_ambulance_years,
         p.verification_status, mm.score, mm.eligible, mm.reasons
  from public.mission_matches mm
  join public.missions m on m.id = mm.mission_id
  join public.professionals p on p.id = mm.professional_id
  join public.profiles pr on pr.id = p.id
  where mm.mission_id = p_mission_id
    and m.company_id = auth.uid()
    and mm.eligible = true
  order by mm.score desc;
$$;

grant execute on function public.company_mission_matches(uuid) to authenticated;

-- Company-side visibility for the marketplace workflow.
create policy "company reads own mission requirements" on public.mission_requirements
for select using (exists (select 1 from public.missions m where m.id = mission_id and m.company_id = auth.uid()));
create policy "company writes own mission requirements" on public.mission_requirements
for all using (exists (select 1 from public.missions m where m.id = mission_id and m.company_id = auth.uid()))
with check (exists (select 1 from public.missions m where m.id = mission_id and m.company_id = auth.uid()));

create policy "company reads own matches" on public.mission_matches
for select using (exists (select 1 from public.missions m where m.id = mission_id and m.company_id = auth.uid()));
create policy "professional reads own matches" on public.mission_matches
for select using (professional_id = auth.uid());

create policy "company reads mission applications" on public.mission_applications
for select using (exists (select 1 from public.missions m where m.id = mission_id and m.company_id = auth.uid()));
create policy "company updates mission applications" on public.mission_applications
for update using (exists (select 1 from public.missions m where m.id = mission_id and m.company_id = auth.uid()))
with check (exists (select 1 from public.missions m where m.id = mission_id and m.company_id = auth.uid()));

create policy "professional reads published missions" on public.missions
for select using (status in ('published','matching','professional_selected','confirmed','in_progress','completed') and exists (select 1 from public.professionals p where p.id = auth.uid()));
create policy "professional reads mission requirements" on public.mission_requirements
for select using (exists (select 1 from public.missions m where m.id = mission_id and m.status in ('published','matching','professional_selected','confirmed','in_progress','completed') and exists (select 1 from public.professionals p where p.id = auth.uid())));

create policy "assignment company read" on public.mission_assignments
for select using (exists (select 1 from public.missions m where m.id = mission_id and m.company_id = auth.uid()));
create policy "assignment professional read" on public.mission_assignments
for select using (professional_id = auth.uid());
create policy "assignment company write" on public.mission_assignments
for all using (exists (select 1 from public.missions m where m.id = mission_id and m.company_id = auth.uid()))
with check (exists (select 1 from public.missions m where m.id = mission_id and m.company_id = auth.uid()));
