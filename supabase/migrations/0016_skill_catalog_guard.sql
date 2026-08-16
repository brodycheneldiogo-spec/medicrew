-- Keep the marketplace skill catalog deterministic.
-- Insert missing catalog rows so the application and database always share the same slugs.
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
  ('vasoactive','Vasoactive infusions','Medication & infusions'),
  ('sedation','Sedation management','Medication & infusions'),
  ('air-ambulance','Air ambulance','Transport'),
  ('fixed-wing','Fixed-wing transport','Transport'),
  ('helicopter','Helicopter transport','Transport'),
  ('commercial-flight','Commercial flight escort','Transport'),
  ('ground-transport','Ground / ambulance transport','Transport'),
  ('international','International transport','Transport'),
  ('medical-repatriation','Medical repatriation','Transport'),
  ('pediatric-transport','Pediatric transport','Specialized transport'),
  ('neonatal-transport','Neonatal transport','Specialized transport'),
  ('trauma','Major trauma / polytrauma','Clinical'),
  ('neurocritical','Neurocritical care','Clinical'),
  ('cardiac-critical-care','Cardiac critical care','Clinical')
on conflict (slug) do update
set name = excluded.name, category = excluded.category;

-- Historical compatibility.
update public.skills
set slug = 'cardiac-critical-care'
where slug = 'cardiac-critical';
