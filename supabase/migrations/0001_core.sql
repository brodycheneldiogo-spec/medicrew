create extension if not exists pgcrypto;

create type public.account_role as enum ('professional','company','admin');
create type public.professional_type as enum ('doctor','nurse');
create type public.verification_status as enum ('pending','verified','rejected','suspended');
create type public.document_status as enum ('pending','verified','rejected','expired');
create type public.mission_status as enum ('draft','published','matching','professional_selected','confirmed','in_progress','completed','cancelled');
create type public.application_status as enum ('pending','accepted','declined','withdrawn');
create type public.requirement_kind as enum ('mandatory','preferred');
create type public.experience_level as enum ('basic','intermediate','advanced','expert');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.account_role not null,
  first_name text,
  last_name text,
  email text,
  phone text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.professionals (
  id uuid primary key references public.profiles(id) on delete cascade,
  professional_type public.professional_type not null,
  date_of_birth date,
  address text,
  nationality text,
  specialty text,
  rpps_number text,
  years_experience integer not null default 0 check (years_experience >= 0),
  medical_transport_years numeric(4,1) not null default 0 check (medical_transport_years >= 0),
  air_ambulance_years numeric(4,1) not null default 0 check (air_ambulance_years >= 0),
  repatriation_years numeric(4,1) not null default 0 check (repatriation_years >= 0),
  emergency_years numeric(4,1) not null default 0 check (emergency_years >= 0),
  icu_years numeric(4,1) not null default 0 check (icu_years >= 0),
  verification_status public.verification_status not null default 'pending',
  available_now boolean not null default false,
  international_available boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.companies (
  id uuid primary key references public.profiles(id) on delete cascade,
  company_name text not null,
  siren text,
  siret text,
  address text,
  contact_name text,
  organization_type text,
  verification_status public.verification_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.skills (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text unique not null,
  category text not null,
  description text,
  created_at timestamptz not null default now()
);

create table public.professional_skills (
  professional_id uuid not null references public.professionals(id) on delete cascade,
  skill_id uuid not null references public.skills(id) on delete cascade,
  experience_level public.experience_level not null default 'basic',
  years_experience numeric(4,1) not null default 0 check (years_experience >= 0),
  verified boolean not null default false,
  primary key (professional_id, skill_id)
);

create table public.professional_languages (
  professional_id uuid not null references public.professionals(id) on delete cascade,
  language_code text not null,
  proficiency public.experience_level not null default 'intermediate',
  primary key (professional_id, language_code)
);

create table public.professional_certifications (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professionals(id) on delete cascade,
  name text not null,
  issuer text,
  issued_at date,
  expires_at date,
  status public.document_status not null default 'pending',
  created_at timestamptz not null default now()
);

create table public.professional_availability (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professionals(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  start_location text,
  max_notice_hours numeric(5,1),
  international boolean not null default false,
  transport_types text[] not null default '{}',
  check (ends_at > starts_at)
);

create table public.missions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  title text not null,
  departure_location text not null,
  destination_location text not null,
  departure_at timestamptz not null,
  estimated_duration_hours numeric(6,2),
  transport_type text not null,
  professional_type public.professional_type not null,
  compensation_cents integer not null check (compensation_cents >= 0),
  expenses_covered boolean not null default false,
  return_arrangements text,
  status public.mission_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.mission_requirements (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.missions(id) on delete cascade,
  skill_id uuid references public.skills(id) on delete restrict,
  language_code text,
  kind public.requirement_kind not null default 'mandatory',
  minimum_level public.experience_level,
  minimum_years numeric(4,1),
  label text,
  check (skill_id is not null or language_code is not null or label is not null)
);

create table public.mission_applications (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.missions(id) on delete cascade,
  professional_id uuid not null references public.professionals(id) on delete cascade,
  status public.application_status not null default 'pending',
  cover_note text,
  created_at timestamptz not null default now(),
  unique (mission_id, professional_id)
);

create table public.mission_matches (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.missions(id) on delete cascade,
  professional_id uuid not null references public.professionals(id) on delete cascade,
  score numeric(5,2) not null check (score >= 0 and score <= 100),
  eligible boolean not null default false,
  reasons text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (mission_id, professional_id)
);

create table public.mission_assignments (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid unique not null references public.missions(id) on delete cascade,
  professional_id uuid not null references public.professionals(id) on delete restrict,
  assigned_at timestamptz not null default now(),
  confirmed_at timestamptz
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.missions(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (mission_id)
);

create table public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  primary key (conversation_id, profile_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete restrict,
  body text not null check (length(trim(body)) > 0),
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null,
  type text not null,
  data jsonb not null default '{}',
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index professionals_status_idx on public.professionals(verification_status);
create index professional_skills_skill_idx on public.professional_skills(skill_id);
create index availability_window_idx on public.professional_availability(starts_at, ends_at);
create index missions_status_departure_idx on public.missions(status, departure_at);
create index mission_requirements_mission_idx on public.mission_requirements(mission_id);
create index matches_mission_score_idx on public.mission_matches(mission_id, eligible, score desc);
create index messages_conversation_created_idx on public.messages(conversation_id, created_at);
create index notifications_profile_created_idx on public.notifications(profile_id, created_at desc);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, role, email, first_name, last_name)
  values (new.id, coalesce((new.raw_user_meta_data->>'role')::public.account_role, 'professional'), new.email, new.raw_user_meta_data->>'first_name', new.raw_user_meta_data->>'last_name');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger profiles_updated_at before update on public.profiles for each row execute procedure public.set_updated_at();
create trigger professionals_updated_at before update on public.professionals for each row execute procedure public.set_updated_at();
create trigger companies_updated_at before update on public.companies for each row execute procedure public.set_updated_at();
create trigger missions_updated_at before update on public.missions for each row execute procedure public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.professionals enable row level security;
alter table public.companies enable row level security;
alter table public.skills enable row level security;
alter table public.professional_skills enable row level security;
alter table public.professional_languages enable row level security;
alter table public.professional_certifications enable row level security;
alter table public.professional_availability enable row level security;
alter table public.missions enable row level security;
alter table public.mission_requirements enable row level security;
alter table public.mission_applications enable row level security;
alter table public.mission_matches enable row level security;
alter table public.mission_assignments enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;

create policy "profiles self read" on public.profiles for select using (id = auth.uid());
create policy "profiles self update" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy "skills authenticated read" on public.skills for select to authenticated using (true);
create policy "professional self read" on public.professionals for select using (id = auth.uid());
create policy "professional self insert" on public.professionals for insert with check (id = auth.uid());
create policy "professional self update" on public.professionals for update using (id = auth.uid()) with check (id = auth.uid());
create policy "company self read" on public.companies for select using (id = auth.uid());
create policy "company self insert" on public.companies for insert with check (id = auth.uid());
create policy "company self update" on public.companies for update using (id = auth.uid()) with check (id = auth.uid());
create policy "professional skills self" on public.professional_skills for all using (professional_id = auth.uid()) with check (professional_id = auth.uid());
create policy "professional languages self" on public.professional_languages for all using (professional_id = auth.uid()) with check (professional_id = auth.uid());
create policy "professional certs self" on public.professional_certifications for all using (professional_id = auth.uid()) with check (professional_id = auth.uid());
create policy "professional availability self" on public.professional_availability for all using (professional_id = auth.uid()) with check (professional_id = auth.uid());
create policy "company missions" on public.missions for all using (company_id = auth.uid()) with check (company_id = auth.uid());
create policy "professional applications" on public.mission_applications for all using (professional_id = auth.uid()) with check (professional_id = auth.uid());
create policy "professional notifications" on public.notifications for select using (profile_id = auth.uid());
create policy "professional notification update" on public.notifications for update using (profile_id = auth.uid()) with check (profile_id = auth.uid());

insert into public.skills (slug,name,category) values
('icu','ICU / Critical Care','Critical care'),
('mechanical-ventilation','Mechanical ventilation','Respiratory'),
('niv','Non-invasive ventilation (NIV)','Respiratory'),
('intubation','Endotracheal intubation','Airway'),
('difficult-airway','Difficult airway management','Airway'),
('ecmo','ECMO','Advanced critical care'),
('vv-ecmo','VV ECMO','Advanced critical care'),
('va-ecmo','VA ECMO','Advanced critical care'),
('central-line','Central line management','Vascular access'),
('arterial-line','Arterial line management','Monitoring'),
('peripheral-iv','Peripheral IV access','Vascular access'),
('ultrasound-iv','Ultrasound-guided IV','Vascular access'),
('invasive-monitoring','Invasive monitoring','Monitoring'),
('capnography','Capnography / EtCO2','Monitoring'),
('ecg','ECG / cardiac monitoring','Monitoring'),
('infusion-pumps','Infusion / syringe pumps','Critical care'),
('vasopressors','Vasoactive infusions','Critical care'),
('sedation','Sedation management','Critical care'),
('air-ambulance','Air ambulance transport','Transport'),
('fixed-wing','Fixed-wing transport','Transport'),
('helicopter','Helicopter transport','Transport'),
('commercial-flight','Commercial flight escort','Transport'),
('ground-transport','Ground medical transport','Transport'),
('international-transport','International transport','Transport'),
('repatriation','Medical repatriation','Transport'),
('pediatric-transport','Pediatric transport','Specialized transport'),
('neonatal-transport','Neonatal transport','Specialized transport'),
('trauma','Major trauma / polytrauma','Clinical'),
('neurocritical','Neurocritical care','Clinical'),
('cardiac-critical-care','Cardiac critical care','Clinical')
on conflict (slug) do nothing;

