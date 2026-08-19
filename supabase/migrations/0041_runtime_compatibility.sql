-- Restore runtime objects that were intentionally removed from duplicate historical
-- migration filenames during migration-history consolidation.
-- This migration is idempotent and keeps a fresh environment aligned with the app.

-- Keep the mobile skill slugs and database catalog identical.
update public.skills
set slug = 'vasopressors'
where slug = 'vasoactive'
  and not exists (select 1 from public.skills where slug = 'vasopressors');

update public.skills
set slug = 'international-transport'
where slug = 'international'
  and not exists (select 1 from public.skills where slug = 'international-transport');

update public.skills
set slug = 'repatriation'
where slug = 'medical-repatriation'
  and not exists (select 1 from public.skills where slug = 'repatriation');

insert into public.skills (slug, name, category)
values
  ('icu','ICU / Critical Care','Clinical'),
  ('mechanical-ventilation','Mechanical ventilation','Airway & respiratory'),
  ('niv','Non-invasive ventilation','Airway & respiratory'),
  ('intubation','Endotracheal intubation','Airway & respiratory'),
  ('difficult-airway','Difficult airway management','Airway & respiratory'),
  ('ecmo','ECMO','Advanced critical care'),
  ('vv-ecmo','VV ECMO','Advanced critical care'),
  ('va-ecmo','VA ECMO','Advanced critical care'),
  ('central-line','Central line management','Vascular access'),
  ('arterial-line','Arterial line management','Vascular access'),
  ('peripheral-iv','Peripheral IV access','Vascular access'),
  ('ultrasound-iv','Ultrasound-guided IV','Vascular access'),
  ('invasive-monitoring','Invasive monitoring','Monitoring'),
  ('capnography','Capnography / EtCO₂','Monitoring'),
  ('ecg','ECG / cardiac monitoring','Monitoring'),
  ('infusion-pumps','Infusion / syringe pumps','Medication & infusions'),
  ('vasopressors','Vasoactive infusions','Medication & infusions'),
  ('sedation','Sedation management','Medication & infusions'),
  ('air-ambulance','Air ambulance','Transport'),
  ('fixed-wing','Fixed-wing transport','Transport'),
  ('helicopter','Helicopter transport','Transport'),
  ('commercial-flight','Commercial flight escort','Transport'),
  ('ground-transport','Ground / ambulance transport','Transport'),
  ('international-transport','International transport','Transport'),
  ('repatriation','Medical repatriation','Transport'),
  ('pediatric-transport','Pediatric transport','Specialized transport'),
  ('neonatal-transport','Neonatal transport','Specialized transport'),
  ('trauma','Major trauma / polytrauma','Clinical'),
  ('neurocritical','Neurocritical care','Clinical'),
  ('cardiac-critical-care','Cardiac critical care','Clinical')
on conflict (slug) do update
set name = excluded.name, category = excluded.category;

-- The app uses the JSON-returning skills RPC to verify persistence after a save.
create or replace function public.replace_my_skills_v2(p_skills jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  v_skill uuid;
  v_level public.experience_level;
  v_years numeric;
  v_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'professional'
  ) then
    raise exception 'This account is not registered as a professional';
  end if;

  insert into public.professionals (id, professional_type)
  values (auth.uid(), 'doctor')
  on conflict (id) do nothing;

  if exists (
    select 1 from public.professionals
    where id = auth.uid() and verification_status = 'suspended'
  ) then
    raise exception 'Professional account unavailable';
  end if;

  delete from public.professional_skills
  where professional_id = auth.uid();

  for item in select * from jsonb_array_elements(coalesce(p_skills, '[]'::jsonb)) loop
    select id into v_skill
    from public.skills
    where slug = lower(trim(item->>'slug'));

    if v_skill is null then
      raise exception 'Unknown skill: %', item->>'slug';
    end if;

    begin
      v_level = coalesce(nullif(item->>'level', '')::public.experience_level, 'basic');
    exception when invalid_text_representation then
      raise exception 'Invalid skill level for %', item->>'slug';
    end;

    begin
      v_years = greatest(coalesce((item->>'years')::numeric, 0), 0);
    exception when invalid_text_representation then
      raise exception 'Invalid years of experience for %', item->>'slug';
    end;

    insert into public.professional_skills (
      professional_id, skill_id, experience_level, years_experience
    ) values (
      auth.uid(), v_skill, v_level, v_years
    );

    v_count := v_count + 1;
  end loop;

  return jsonb_build_object(
    'saved_count', v_count,
    'slugs', coalesce((
      select jsonb_agg(s.slug order by s.slug)
      from public.professional_skills ps
      join public.skills s on s.id = ps.skill_id
      where ps.professional_id = auth.uid()
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.replace_my_skills_v2(jsonb) from public;
grant execute on function public.replace_my_skills_v2(jsonb) to authenticated;
