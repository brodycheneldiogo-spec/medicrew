-- MediCrew marketplace payments.
-- Companies pay MediCrew for a confirmed mission. MediCrew retains 5% and later transfers 95% to the verified professional's connected account after both sides confirm completion.
-- Payment processing is performed server-side through Stripe Connect; no Stripe secret is stored in the app.

create type public.mission_payment_status as enum ('pending','processing','paid','failed','refunded','released');

alter table public.professionals
  add column if not exists stripe_connect_account_id text,
  add column if not exists stripe_connect_onboarding_complete boolean not null default false;

create table if not exists public.mission_payments (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null unique references public.missions(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete restrict,
  professional_id uuid not null references public.professionals(id) on delete restrict,
  amount_cents integer not null check (amount_cents > 0),
  platform_fee_cents integer not null check (platform_fee_cents >= 0),
  professional_amount_cents integer not null check (professional_amount_cents >= 0),
  currency text not null default 'eur' check (length(currency)=3),
  status public.mission_payment_status not null default 'pending',
  stripe_payment_intent_id text unique,
  stripe_charge_id text,
  stripe_transfer_id text unique,
  paid_at timestamptz,
  released_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (professional_amount_cents + platform_fee_cents = amount_cents)
);

create index if not exists mission_payments_company_idx on public.mission_payments(company_id, created_at desc);
create index if not exists mission_payments_professional_idx on public.mission_payments(professional_id, created_at desc);
create index if not exists mission_payments_status_idx on public.mission_payments(status);

alter table public.mission_payments enable row level security;
create policy mission_payments_company_read on public.mission_payments for select to authenticated using (company_id=auth.uid());
create policy mission_payments_professional_read on public.mission_payments for select to authenticated using (professional_id=auth.uid());

create or replace function public.prepare_mission_payment(p_mission_id uuid)
returns table(payment_id uuid, amount_cents integer, platform_fee_cents integer, professional_amount_cents integer, currency text, status public.mission_payment_status)
language plpgsql security definer set search_path=public
as $$
declare
  v_company uuid;
  v_professional uuid;
  v_amount integer;
  v_fee integer;
  v_existing public.mission_payment_status;
  v_payment uuid;
begin
  select m.company_id, a.professional_id, m.compensation_cents
    into v_company, v_professional, v_amount
  from public.missions m
  join public.mission_assignments a on a.mission_id=m.id
  where m.id=p_mission_id and m.status='confirmed'
  for update;

  if v_company is null or v_company<>auth.uid() then raise exception 'Only the mission company can initiate payment'; end if;
  if v_amount <= 0 then raise exception 'Mission compensation must be greater than zero'; end if;

  select mp.status into v_existing from public.mission_payments mp where mp.mission_id=p_mission_id;
  if v_existing in ('paid','processing','released') then
    return query select mp.id,mp.amount_cents,mp.platform_fee_cents,mp.professional_amount_cents,mp.currency,mp.status from public.mission_payments mp where mp.mission_id=p_mission_id;
    return;
  end if;

  v_fee := round(v_amount * 0.05);
  insert into public.mission_payments(mission_id,company_id,professional_id,amount_cents,platform_fee_cents,professional_amount_cents,currency,status)
  values(p_mission_id,v_company,v_professional,v_amount,v_fee,v_amount-v_fee,'eur','pending')
  on conflict(mission_id) do update set
    company_id=excluded.company_id,
    professional_id=excluded.professional_id,
    amount_cents=excluded.amount_cents,
    platform_fee_cents=excluded.platform_fee_cents,
    professional_amount_cents=excluded.professional_amount_cents,
    status=case when public.mission_payments.status in ('failed','refunded') then 'pending' else public.mission_payments.status end,
    updated_at=now()
  returning id into v_payment;

  return query select mp.id,mp.amount_cents,mp.platform_fee_cents,mp.professional_amount_cents,mp.currency,mp.status from public.mission_payments mp where mp.id=v_payment;
end;
$$;
revoke all on function public.prepare_mission_payment(uuid) from public;
grant execute on function public.prepare_mission_payment(uuid) to authenticated;

-- Payment is a prerequisite to starting a confirmed mission.
create or replace function public.advance_mission_status(p_mission_id uuid,p_next_status public.mission_status)
returns public.mission_status
language plpgsql security definer set search_path=public as $$
declare
  v_company_id uuid;
  v_assigned uuid;
  v_current public.mission_status;
  v_payment public.mission_payment_status;
begin
  select company_id,status into v_company_id,v_current from public.missions where id=p_mission_id for update;
  if v_company_id is null then raise exception 'Mission not found'; end if;
  select professional_id into v_assigned from public.mission_assignments where mission_id=p_mission_id;
  if auth.uid()<>v_company_id and auth.uid()<>v_assigned then raise exception 'Not authorized for this mission'; end if;

  if p_next_status='in_progress' then
    if v_current<>'confirmed' then raise exception 'Only confirmed missions can start'; end if;
    select status into v_payment from public.mission_payments where mission_id=p_mission_id;
    if v_payment is distinct from 'paid' then raise exception 'Mission payment must be completed before the mission can start'; end if;
  elsif p_next_status='cancelled' then
    if v_current in ('completed','cancelled') then raise exception 'Mission can no longer be cancelled'; end if;
    if v_current='in_progress' then raise exception 'In-progress missions are locked and cannot be cancelled'; end if;
  elsif p_next_status='completed' then
    raise exception 'Use confirm_mission_completion; both parties must confirm';
  else raise exception 'Unsupported status transition'; end if;

  update public.missions set status=p_next_status,updated_at=now() where id=p_mission_id;
  if v_assigned is not null then
    insert into public.notifications(profile_id,title,body,type,data)
    values(case when auth.uid()=v_company_id then v_assigned else v_company_id end,
      case p_next_status when 'in_progress' then 'Mission started' else 'Mission cancelled' end,
      case p_next_status when 'in_progress' then 'The MediCrew mission is now in progress.' else 'The MediCrew mission has been cancelled.' end,
      'mission_status',jsonb_build_object('mission_id',p_mission_id,'status',p_next_status));
  end if;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(auth.uid(),'mission_status_changed','mission',p_mission_id,jsonb_build_object('status',p_next_status,'previous_status',v_current));
  return p_next_status;
end;
$$;
revoke all on function public.advance_mission_status(uuid,public.mission_status) from public;
grant execute on function public.advance_mission_status(uuid,public.mission_status) to authenticated;

-- Once both parties confirm completion, the payment becomes eligible for server-side release.
create or replace function public.mark_payment_release_ready(p_mission_id uuid)
returns boolean
language plpgsql security definer set search_path=public
as $$
declare v_company uuid; v_professional uuid; v_status public.mission_status; v_payment public.mission_payment_status;
begin
  select m.company_id,m.status,a.professional_id into v_company,v_status,v_professional from public.missions m join public.mission_assignments a on a.mission_id=m.id where m.id=p_mission_id;
  if v_company is null or (auth.uid()<>v_company and auth.uid()<>v_professional) then raise exception 'Not authorized for this mission'; end if;
  if v_status<>'completed' then raise exception 'Mission must be completed by both parties'; end if;
  select status into v_payment from public.mission_payments where mission_id=p_mission_id;
  if v_payment<>'paid' then raise exception 'Payment is not ready for release'; end if;
  return true;
end;
$$;
revoke all on function public.mark_payment_release_ready(uuid) from public;
grant execute on function public.mark_payment_release_ready(uuid) to authenticated;
