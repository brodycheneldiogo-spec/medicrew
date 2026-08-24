-- MediCrew billing model v2:
-- the company pays the professional directly after the mission;
-- MediCrew invoices the company separately for its platform service fee.

alter table public.missions
  add column if not exists service_fee_bps integer not null default 1100,
  add column if not exists service_fee_cents bigint,
  add column if not exists company_billing_terms_version text,
  add column if not exists company_billing_terms_accepted_at timestamptz;

update public.missions
set service_fee_cents=round(compensation_cents * service_fee_bps / 10000.0)::bigint
where service_fee_cents is null;

create or replace function public.calculate_mission_service_fee()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.service_fee_bps is null or new.service_fee_bps < 0 or new.service_fee_bps > 5000 then
    raise exception 'Invalid MediCrew service fee';
  end if;
  new.service_fee_cents := round(coalesce(new.compensation_cents,0) * new.service_fee_bps / 10000.0)::bigint;
  return new;
end;
$$;
drop trigger if exists missions_calculate_service_fee on public.missions;
create trigger missions_calculate_service_fee before insert or update of compensation_cents,service_fee_bps
on public.missions for each row execute function public.calculate_mission_service_fee();

create table if not exists public.company_billing_acceptances (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.missions(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  terms_version text not null,
  professional_fee_cents bigint not null check(professional_fee_cents >= 0),
  service_fee_bps integer not null check(service_fee_bps >= 0 and service_fee_bps <= 5000),
  service_fee_cents bigint not null check(service_fee_cents >= 0),
  accepted_at timestamptz not null default now(),
  unique(mission_id)
);
alter table public.company_billing_acceptances enable row level security;
drop policy if exists company_billing_acceptances_company_read on public.company_billing_acceptances;
drop policy if exists company_billing_acceptances_company_insert on public.company_billing_acceptances;
drop policy if exists company_billing_acceptances_admin_read on public.company_billing_acceptances;
create policy company_billing_acceptances_company_read on public.company_billing_acceptances for select to authenticated using(company_id=auth.uid());
create policy company_billing_acceptances_company_insert on public.company_billing_acceptances for insert to authenticated with check(company_id=auth.uid());
create policy company_billing_acceptances_admin_read on public.company_billing_acceptances for select to authenticated using(exists(select 1 from public.profiles where id=auth.uid() and role='admin'));

create table if not exists public.mission_invoices (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null unique references public.missions(id) on delete restrict,
  company_id uuid not null references public.companies(id) on delete restrict,
  stripe_customer_id text,
  stripe_invoice_id text unique,
  status text not null default 'pending' check(status in ('pending','draft','open','paid','void','uncollectible','failed')),
  amount_cents bigint not null check(amount_cents >= 0),
  currency text not null default 'eur',
  hosted_invoice_url text,
  invoice_pdf_url text,
  due_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists mission_invoices_company_idx on public.mission_invoices(company_id,created_at desc);
create index if not exists mission_invoices_status_idx on public.mission_invoices(status,created_at desc);
alter table public.mission_invoices enable row level security;
drop policy if exists mission_invoices_company_read on public.mission_invoices;
drop policy if exists mission_invoices_admin_read on public.mission_invoices;
create policy mission_invoices_company_read on public.mission_invoices for select to authenticated using(company_id=auth.uid());
create policy mission_invoices_admin_read on public.mission_invoices for select to authenticated using(exists(select 1 from public.profiles where id=auth.uid() and role='admin'));

create or replace function public.company_accepts_mission_billing(
  p_mission_id uuid,
  p_terms_version text default '1.0'
)
returns public.missions language plpgsql security definer set search_path=public as $$
declare v_m public.missions; v_uid uuid:=auth.uid();
begin
  select * into v_m from public.missions where id=p_mission_id and company_id=v_uid for update;
  if v_m.id is null then raise exception 'Mission not found or not owned by company'; end if;
  if v_m.compensation_cents < 0 then raise exception 'Invalid professional fee'; end if;
  insert into public.company_billing_acceptances(mission_id,company_id,terms_version,professional_fee_cents,service_fee_bps,service_fee_cents)
  values(v_m.id,v_uid,p_terms_version,v_m.compensation_cents,v_m.service_fee_bps,v_m.service_fee_cents)
  on conflict(mission_id) do nothing;
  update public.missions set company_billing_terms_version=p_terms_version,company_billing_terms_accepted_at=now(),updated_at=now() where id=v_m.id returning * into v_m;
  return v_m;
end;
$$;
revoke all on function public.company_accepts_mission_billing(uuid,text) from public;
grant execute on function public.company_accepts_mission_billing(uuid,text) to authenticated;

-- The professional is paid outside MediCrew, so mission start is no longer gated by a MediCrew escrow payment.
create or replace function public.advance_mission_status(p_mission_id uuid,p_next_status public.mission_status)
returns public.mission_status language plpgsql security definer set search_path=public as $$
declare v_company_id uuid; v_assigned uuid; v_current public.mission_status;
begin
  select company_id,status into v_company_id,v_current from public.missions where id=p_mission_id for update;
  if v_company_id is null then raise exception 'Mission not found'; end if;
  select professional_id into v_assigned from public.mission_assignments where mission_id=p_mission_id;
  if auth.uid()<>v_company_id and auth.uid()<>v_assigned then raise exception 'Not authorized for this mission'; end if;
  if p_next_status='in_progress' then
    if v_current<>'confirmed' then raise exception 'Only confirmed missions can start'; end if;
  elsif p_next_status='cancelled' then
    if v_current in ('completed','cancelled') then raise exception 'Mission can no longer be cancelled'; end if;
    if v_current='in_progress' then raise exception 'In-progress missions are locked and cannot be cancelled'; end if;
  elsif p_next_status='completed' then
    raise exception 'Use confirm_mission_completion; both parties must confirm';
  else raise exception 'Unsupported status transition';
  end if;
  update public.missions set status=p_next_status,updated_at=now() where id=p_mission_id;
  if v_assigned is not null then
    insert into public.notifications(profile_id,title,body,type,data) values
      (case when auth.uid()=v_company_id then v_assigned else v_company_id end,
       case p_next_status when 'in_progress' then 'Mission started' else 'Mission cancelled' end,
       case p_next_status when 'in_progress' then 'The mission is now in progress.' else 'The mission has been cancelled.' end,
       'mission_status',jsonb_build_object('mission_id',p_mission_id,'status',p_next_status,'email',true));
  end if;
  return p_next_status;
end;
$$;
revoke all on function public.advance_mission_status(uuid,public.mission_status) from public;
grant execute on function public.advance_mission_status(uuid,public.mission_status) to authenticated;

comment on table public.mission_invoices is 'MediCrew service-fee invoices. Professional compensation is paid directly by the company outside MediCrew.';

