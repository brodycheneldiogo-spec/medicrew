-- Collect only MediCrew's service fee before confirming a selected professional.
create table if not exists public.mission_service_fee_payments (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null unique references public.missions(id) on delete restrict,
  company_id uuid not null references public.companies(id) on delete restrict,
  professional_id uuid not null references public.professionals(id) on delete restrict,
  amount_cents bigint not null check (amount_cents > 0),
  currency text not null,
  status text not null default 'pending' check (status in ('pending','checkout_created','paid','failed','refunded')),
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text unique,
  stripe_refund_id text unique,
  checkout_url text,
  paid_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.mission_service_fee_payments enable row level security;
revoke all on table public.mission_service_fee_payments from anon, authenticated;
grant select on table public.mission_service_fee_payments to authenticated;

create policy mission_service_fee_company_read on public.mission_service_fee_payments
for select to authenticated using ((select auth.uid()) = company_id);
create policy mission_service_fee_professional_read on public.mission_service_fee_payments
for select to authenticated using ((select auth.uid()) = professional_id);
create policy mission_service_fee_admin_read on public.mission_service_fee_payments
for select to authenticated using (exists (
  select 1 from public.profiles where id=(select auth.uid()) and role='admin'
));

create or replace function public.select_mission_professional(p_mission_id uuid, p_professional_id uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_company_id uuid;v_match_id uuid;v_assignment_id uuid;v_status public.mission_status;
begin
  select company_id,status into v_company_id,v_status from public.missions where id=p_mission_id for update;
  if v_company_id is null or v_company_id<>auth.uid() then raise exception 'Not authorized to select a professional'; end if;
  if v_status<>'matching' then raise exception 'Mission is not available for selection'; end if;
  select id into v_match_id from public.mission_matches where mission_id=p_mission_id and professional_id=p_professional_id and eligible=true;
  if v_match_id is null then raise exception 'Professional is not an eligible match'; end if;
  if not exists(select 1 from public.professionals where id=p_professional_id and verification_status='verified') then raise exception 'Professional is no longer verified'; end if;
  insert into public.mission_assignments(mission_id,professional_id,confirmed_at)
  values(p_mission_id,p_professional_id,null)
  on conflict(mission_id) do update set professional_id=excluded.professional_id,confirmed_at=null
  returning id into v_assignment_id;
  update public.missions set status='professional_selected',updated_at=now() where id=p_mission_id;
  insert into public.notifications(profile_id,title,body,type,data) values
    (p_professional_id,'Selected — payment pending','A company selected you. The mission is confirmed only after its MediCrew service fee is paid.','professional_selected',jsonb_build_object('mission_id',p_mission_id,'email',true)),
    (auth.uid(),'Professional selected','Pay the MediCrew service fee now to confirm the mission. Professional compensation remains payable directly.','service_fee_payment_required',jsonb_build_object('mission_id',p_mission_id,'professional_id',p_professional_id,'email',true,'url','/company-payments'));
  return v_assignment_id;
end;$$;
revoke all on function public.select_mission_professional(uuid,uuid) from public;
grant execute on function public.select_mission_professional(uuid,uuid) to authenticated;

create or replace function public.advance_mission_status(p_mission_id uuid,p_next_status public.mission_status)
returns public.mission_status language plpgsql security definer set search_path=public as $$
declare v_company_id uuid;v_assigned uuid;v_current public.mission_status;v_paid boolean;
begin
  select company_id,status into v_company_id,v_current from public.missions where id=p_mission_id for update;
  if v_company_id is null then raise exception 'Mission not found'; end if;
  select professional_id into v_assigned from public.mission_assignments where mission_id=p_mission_id;
  if auth.uid()<>v_company_id and auth.uid()<>v_assigned then raise exception 'Not authorized for this mission'; end if;
  select exists(select 1 from public.mission_service_fee_payments where mission_id=p_mission_id and status='paid') into v_paid;
  if p_next_status='in_progress' then
    if v_current<>'confirmed' then raise exception 'Only paid and confirmed missions can start'; end if;
    if not v_paid then raise exception 'MediCrew service fee payment is required before the mission starts'; end if;
  elsif p_next_status='cancelled' then
    if v_current in ('completed','cancelled') then raise exception 'Mission can no longer be cancelled'; end if;
    if v_current='in_progress' then raise exception 'In-progress missions are locked and cannot be cancelled'; end if;
    if auth.uid()=v_assigned and v_paid then raise exception 'Use the secure cancellation flow so the company is refunded'; end if;
  elsif p_next_status='completed' then raise exception 'Use confirm_mission_completion; both parties must confirm';
  else raise exception 'Unsupported status transition'; end if;
  update public.missions set status=p_next_status,updated_at=now() where id=p_mission_id;
  return p_next_status;
end;$$;
revoke all on function public.advance_mission_status(uuid,public.mission_status) from public;
grant execute on function public.advance_mission_status(uuid,public.mission_status) to authenticated;

comment on table public.mission_service_fee_payments is 'Pre-mission payments of MediCrew service fees only; professional compensation remains outside MediCrew.';
