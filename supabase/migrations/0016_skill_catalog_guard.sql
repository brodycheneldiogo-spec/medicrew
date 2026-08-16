-- Keep the marketplace skill catalog deterministic and prevent duplicate slugs.
-- This migration also normalizes the known historical slug mismatch.
update public.skills
set slug = 'cardiac-critical-care'
where slug = 'cardiac-critical';

-- Fail fast if the app/database catalog ever drifts again during development.
do $$
declare
  expected text[] := array[
    'icu','mechanical-ventilation','niv','intubation','difficult-airway',
    'ecmo','vv-ecmo','va-ecmo','central-line','arterial-line','peripheral-iv',
    'ultrasound-iv','invasive-monitoring','capnography','ecg','infusion-pumps',
    'vasoactive','sedation','air-ambulance','fixed-wing','helicopter',
    'commercial-flight','ground-transport','international','medical-repatriation',
    'pediatric-transport','neonatal-transport','trauma','neurocritical',
    'cardiac-critical-care'
  ];
  missing text[];
begin
  select array_agg(x order by x) into missing
  from unnest(expected) x
  where not exists (select 1 from public.skills s where s.slug = x);

  if missing is not null then
    raise exception 'MediCrew skill catalog missing database slugs: %', missing;
  end if;
end $$;
