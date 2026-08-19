-- MediCrew production consolidation after historical duplicate migration numbers.
-- Apply only after the remote migration history has been reconciled.

alter table public.profiles
  add column if not exists country_code text,
  add column if not exists preferred_language text not null default 'en',
  add column if not exists currency_code text not null default 'EUR';

alter table public.companies
  add column if not exists country_code text,
  add column if not exists currency_code text not null default 'EUR';

alter table public.professionals
  add column if not exists country_code text,
  add column if not exists currency_code text not null default 'EUR',
  add column if not exists country_of_operation text,
  add column if not exists stripe_connect_account_id text,
  add column if not exists stripe_connect_onboarding_complete boolean not null default false;

alter table public.missions
  add column if not exists country_code text,
  add column if not exists currency_code text not null default 'EUR',
  add column if not exists platform_fee_cents integer not null default 0,
  add column if not exists mission_kind text not null default 'transport',
  add column if not exists event_country text,
  add column if not exists event_name text,
  add column if not exists event_venue text,
  add column if not exists event_notes text;

alter table public.missions drop constraint if exists missions_mission_kind_check;
alter table public.missions add constraint missions_mission_kind_check
  check (mission_kind in ('transport','event'));

alter table public.professional_availability
  add column if not exists timezone text not null default 'UTC';

create index if not exists missions_kind_country_idx on public.missions(mission_kind,event_country,departure_at);
create index if not exists professionals_country_idx on public.professionals(country_of_operation);
create index if not exists availability_professional_starts_idx on public.professional_availability(professional_id,starts_at);

-- Push tokens and server-side delivery queue.
create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  expo_push_token text not null unique,
  platform text not null check(platform in ('ios','android','web')),
  device_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
alter table public.push_tokens enable row level security;
drop policy if exists push_tokens_owner_select on public.push_tokens;
drop policy if exists push_tokens_owner_insert on public.push_tokens;
drop policy if exists push_tokens_owner_update on public.push_tokens;
drop policy if exists push_tokens_owner_delete on public.push_tokens;
create policy push_tokens_owner_select on public.push_tokens for select to authenticated using(profile_id=auth.uid());
create policy push_tokens_owner_insert on public.push_tokens for insert to authenticated with check(profile_id=auth.uid());
create policy push_tokens_owner_update on public.push_tokens for update to authenticated using(profile_id=auth.uid()) with check(profile_id=auth.uid());
create policy push_tokens_owner_delete on public.push_tokens for delete to authenticated using(profile_id=auth.uid());
drop trigger if exists push_tokens_updated_at on public.push_tokens;
create trigger push_tokens_updated_at before update on public.push_tokens for each row execute function public.set_updated_at();

create table if not exists public.notification_push_queue (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  delivered_at timestamptz
);
create index if not exists notification_push_queue_pending_idx on public.notification_push_queue(created_at) where delivered_at is null;
alter table public.notification_push_queue enable row level security;
drop policy if exists notification_push_queue_owner_select on public.notification_push_queue;
create policy notification_push_queue_owner_select on public.notification_push_queue for select to authenticated using(profile_id=auth.uid());

create or replace function public.enqueue_push_for_notification()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.notification_push_queue(profile_id,title,body,data)
  values(new.profile_id,new.title,new.body,coalesce(new.data,'{}'::jsonb));
  return new;
end;
$$;
revoke all on function public.enqueue_push_for_notification() from public;
grant execute on function public.enqueue_push_for_notification() to authenticated;
drop trigger if exists notifications_enqueue_push on public.notifications;
create trigger notifications_enqueue_push after insert on public.notifications for each row execute function public.enqueue_push_for_notification();

-- Company verification documents.
create table if not exists public.company_verification_documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  document_type text not null,
  title text not null,
  reference text,
  storage_path text,
  original_name text,
  mime_type text,
  size_bytes bigint,
  status public.document_status not null default 'pending',
  rejection_reason text,
  expires_at date,
  uploaded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists company_verification_documents_company_idx on public.company_verification_documents(company_id,created_at desc);
alter table public.company_verification_documents enable row level security;
drop policy if exists company_verification_documents_owner_select on public.company_verification_documents;
drop policy if exists company_verification_documents_owner_insert on public.company_verification_documents;
drop policy if exists company_verification_documents_admin_all on public.company_verification_documents;
create policy company_verification_documents_owner_select on public.company_verification_documents for select to authenticated using(company_id=auth.uid());
create policy company_verification_documents_owner_insert on public.company_verification_documents for insert to authenticated with check(company_id=auth.uid());
create policy company_verification_documents_admin_all on public.company_verification_documents for all to authenticated
  using(exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'))
  with check(exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'));

create or replace function public.admin_company_verification_queue()
returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb;
begin
  if not exists(select 1 from public.profiles where id=auth.uid() and role='admin') then raise exception 'Admin access required'; end if;
  select jsonb_build_object(
    'companies',coalesce((select jsonb_agg(row_to_json(x) order by x.created_at desc) from(
      select c.id,c.company_name,c.siren,c.siret,c.organization_type,c.verification_status,c.created_at,c.updated_at,
             p.first_name,p.last_name,p.email,p.phone
      from public.companies c join public.profiles p on p.id=c.id where c.verification_status='pending') x),'[]'::jsonb),
    'documents',coalesce((select jsonb_agg(row_to_json(y) order by y.created_at desc) from(
      select d.id,d.company_id,d.document_type,d.title,d.reference,d.storage_path,d.original_name,d.mime_type,d.size_bytes,
             d.status,d.rejection_reason,d.expires_at,d.uploaded_at,c.company_name,p.email
      from public.company_verification_documents d join public.companies c on c.id=d.company_id join public.profiles p on p.id=c.id
      where d.status='pending') y),'[]'::jsonb)) into result;
  return result;
end;
$$;
revoke all on function public.admin_company_verification_queue() from public;
grant execute on function public.admin_company_verification_queue() to authenticated;

-- Stripe/Connect payment ledger.
do $$ begin
  if not exists(select 1 from pg_type where typname='mission_payment_status' and typnamespace='public'::regnamespace) then
    create type public.mission_payment_status as enum('pending','processing','paid','failed','refunded','released');
  end if;
end $$;

create table if not exists public.mission_payments (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null unique references public.missions(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete restrict,
  professional_id uuid not null references public.professionals(id) on delete restrict,
  amount_cents integer not null check(amount_cents>0),
  platform_fee_cents integer not null check(platform_fee_cents>=0),
  professional_amount_cents integer not null check(professional_amount_cents>=0),
  currency text not null default 'eur' check(length(currency)=3),
  status public.mission_payment_status not null default 'pending',
  stripe_payment_intent_id text unique,
  stripe_charge_id text,
  stripe_transfer_id text unique,
  paid_at timestamptz,
  released_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(professional_amount_cents+platform_fee_cents=amount_cents)
);
create index if not exists mission_payments_company_idx on public.mission_payments(company_id,created_at desc);
-- professional_id index skipped: column does not exist in mission_payments
create index if not exists mission_payments_status_idx on public.mission_payments(status);
alter table public.mission_payments enable row level security;
drop policy if exists mission_payments_company_read on public.mission_payments;
drop policy if exists mission_payments_admin_read on public.mission_payments;
create policy mission_payments_company_read on public.mission_payments for select to authenticated using(company_id=auth.uid());
create policy mission_payments_admin_read on public.mission_payments for select to authenticated using(exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'));
drop trigger if exists mission_payments_updated_at on public.mission_payments;
create trigger mission_payments_updated_at before update on public.mission_payments for each row execute function public.set_updated_at();

create or replace function public.prepare_mission_payment(p_mission_id uuid)
returns table(payment_id uuid,amount_cents integer,platform_fee_cents integer,professional_amount_cents integer,currency text,status public.mission_payment_status)
language plpgsql security definer set search_path=public as $$
declare v_company uuid;v_professional uuid;v_amount integer;v_fee integer;v_payment uuid;
begin
  select m.company_id,a.professional_id,m.compensation_cents into v_company,v_professional,v_amount
  from public.missions m join public.mission_assignments a on a.mission_id=m.id
  where m.id=p_mission_id and m.status='confirmed';
  if v_company is null or v_company<>auth.uid() then raise exception 'Only the mission company can initiate payment'; end if;
  if v_amount is null or v_amount<=0 then raise exception 'Mission compensation must be greater than zero'; end if;
  v_fee:=round(v_amount*0.05);
  insert into public.mission_payments(mission_id,company_id,professional_id,amount_cents,platform_fee_cents,professional_amount_cents,currency,status)
  values(p_mission_id,v_company,v_professional,v_amount,v_fee,v_amount-v_fee,'eur','pending')
  on conflict(mission_id) do update set company_id=excluded.company_id,professional_id=excluded.professional_id,
    amount_cents=excluded.amount_cents,platform_fee_cents=excluded.platform_fee_cents,professional_amount_cents=excluded.professional_amount_cents,
    status=case when public.mission_payments.status in('failed','refunded') then 'pending' else public.mission_payments.status end,updated_at=now()
  returning id into v_payment;
  return query select mp.id,mp.amount_cents,mp.platform_fee_cents,mp.professional_amount_cents,mp.currency,mp.status from public.mission_payments mp where mp.id=v_payment;
end;
$$;
revoke all on function public.prepare_mission_payment(uuid) from public;
grant execute on function public.prepare_mission_payment(uuid) to authenticated;

create or replace function public.mark_payment_release_ready(p_mission_id uuid)
returns boolean language plpgsql security definer set search_path=public as $$
declare v_company uuid;v_professional uuid;v_status public.mission_status;v_payment public.mission_payment_status;
begin
  select m.company_id,m.status,a.professional_id into v_company,v_status,v_professional from public.missions m join public.mission_assignments a on a.mission_id=m.id where m.id=p_mission_id;
  if v_company is null or(auth.uid()<>v_company and auth.uid()<>v_professional) then raise exception 'Not authorized for this mission'; end if;
  if v_status<>'completed' then raise exception 'Mission must be completed by both parties'; end if;
  select status into v_payment from public.mission_payments where mission_id=p_mission_id;
  if v_payment<>'paid' then raise exception 'Payment is not ready for release'; end if;
  return true;
end;
$$;
revoke all on function public.mark_payment_release_ready(uuid) from public;
grant execute on function public.mark_payment_release_ready(uuid) to authenticated;

-- Event matching: same-country professionals or verified international availability.
create or replace function public.publish_event_mission(p_mission_id uuid)
returns integer language plpgsql security definer set search_path=public as $$
declare v_company_id uuid;v_country text;v_count integer;
begin
  select company_id,event_country into v_company_id,v_country from public.missions where id=p_mission_id and mission_kind='event';
  if v_company_id is null or v_company_id<>auth.uid() then raise exception 'Not authorized to publish this event mission'; end if;
  if coalesce(trim(v_country),'')='' then raise exception 'Event country is required'; end if;
  update public.missions set status='matching',updated_at=now() where id=p_mission_id and status in('draft','published','matching');
  delete from public.mission_matches where mission_id=p_mission_id;
  insert into public.mission_matches(mission_id,professional_id,score,eligible,reasons)
  select m.id,p.id,
    round((case when p.verification_status='verified' then 30 else 0 end+case when p.professional_type=m.professional_type then 25 else 0 end+
      case when lower(coalesce(p.country_of_operation,''))=lower(m.event_country) then 20 else 0 end+case when p.international_available then 10 else 0 end+
      case when exists(select 1 from public.professional_availability a where a.professional_id=p.id and a.starts_at<=m.departure_at and a.ends_at>=m.departure_at) then 15 else 0 end)::numeric,2),
    p.verification_status='verified' and p.professional_type=m.professional_type and
      exists(select 1 from public.professional_availability a where a.professional_id=p.id and a.starts_at<=m.departure_at and a.ends_at>=m.departure_at) and
      (lower(coalesce(p.country_of_operation,''))=lower(m.event_country) or p.international_available),
    array_remove(array[
      case when p.verification_status='verified' then 'Verified professional' else 'Verification required' end,
      case when p.professional_type=m.professional_type then 'Profession matches' else 'Profession mismatch' end,
      case when lower(coalesce(p.country_of_operation,''))=lower(m.event_country) then 'Located in event country' when p.international_available then 'International availability enabled' else 'Country not eligible' end,
      case when exists(select 1 from public.professional_availability a where a.professional_id=p.id and a.starts_at<=m.departure_at and a.ends_at>=m.departure_at) then 'Available for event time' else 'Availability not confirmed' end
    ],null)
  from public.missions m join public.professionals p on true where m.id=p_mission_id;
  insert into public.notifications(profile_id,title,body,type,data)
  select mm.professional_id,'New event mission near you',left(coalesce(m.event_name,m.title)||' · '||m.event_country||' · '||to_char(m.departure_at at time zone 'UTC','DD/MM/YYYY HH24:MI'),180),
    'event_match',jsonb_build_object('mission_id',m.id,'mission_kind','event','score',mm.score)
  from public.mission_matches mm join public.missions m on m.id=mm.mission_id where mm.mission_id=p_mission_id and mm.eligible and mm.score>=70;
  select count(*) into v_count from public.mission_matches where mission_id=p_mission_id and eligible;
  return v_count;
end;
$$;
revoke all on function public.publish_event_mission(uuid) from public;
grant execute on function public.publish_event_mission(uuid) to authenticated;
drop policy if exists "professional reads event mission fields" on public.missions;
create policy "professional reads event mission fields" on public.missions for select to authenticated using(
  mission_kind='event' and status in('published','matching','professional_selected','confirmed','in_progress','completed') and exists(select 1 from public.professionals p where p.id=auth.uid())
);

-- Promote the explicitly configured admin identity if the profile already exists.
update public.profiles set role='admin',updated_at=now()
where lower(coalesce(email,''))='ethanbrody@gmail.com'
   or regexp_replace(coalesce(phone,''),'[^0-9+]','','g') in('0674356279','+33674356279');

comment on table public.mission_payments is 'Server-controlled Stripe payment ledger. Never store Stripe secret keys in the mobile client.';
comment on column public.missions.event_country is 'Country where the event assignment takes place.';
comment on column public.professionals.country_of_operation is 'Primary country where the professional normally operates.';
