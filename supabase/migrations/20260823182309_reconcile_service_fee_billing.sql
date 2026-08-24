-- Complete the service-fee billing migration skipped by the remote 0046
-- version collision. The professional continues to be paid outside MediCrew.
alter table public.missions
  add column if not exists service_fee_bps integer not null default 1100,
  add column if not exists service_fee_cents bigint,
  add column if not exists company_billing_terms_version text,
  add column if not exists company_billing_terms_accepted_at timestamptz;

update public.missions
set service_fee_cents = round(compensation_cents * service_fee_bps / 10000.0)::bigint
where service_fee_cents is null;

alter table public.missions
  alter column service_fee_cents set not null;

create or replace function public.calculate_mission_service_fee()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.service_fee_bps is null or new.service_fee_bps < 0 or new.service_fee_bps > 5000 then
    raise exception 'Invalid MediCrew service fee';
  end if;
  new.service_fee_cents := round(coalesce(new.compensation_cents, 0) * new.service_fee_bps / 10000.0)::bigint;
  return new;
end;
$$;

drop trigger if exists missions_calculate_service_fee on public.missions;
create trigger missions_calculate_service_fee
before insert or update of compensation_cents, service_fee_bps
on public.missions
for each row execute function public.calculate_mission_service_fee();

create or replace function public.company_accepts_mission_billing(
  p_mission_id uuid,
  p_terms_version text default '1.0'
)
returns public.missions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_m public.missions;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select * into v_m
  from public.missions
  where id = p_mission_id and company_id = v_uid
  for update;

  if v_m.id is null then
    raise exception 'Mission not found or not owned by company';
  end if;
  if v_m.compensation_cents < 0 then
    raise exception 'Invalid professional fee';
  end if;

  insert into public.company_billing_acceptances (
    mission_id, company_id, terms_version, professional_fee_cents,
    service_fee_bps, service_fee_cents
  ) values (
    v_m.id, v_uid, p_terms_version, v_m.compensation_cents,
    v_m.service_fee_bps, v_m.service_fee_cents
  ) on conflict (mission_id) do nothing;

  update public.missions
  set company_billing_terms_version = p_terms_version,
      company_billing_terms_accepted_at = now(),
      updated_at = now()
  where id = v_m.id
  returning * into v_m;

  return v_m;
end;
$$;

revoke all on function public.company_accepts_mission_billing(uuid, text) from public;
grant execute on function public.company_accepts_mission_billing(uuid, text) to authenticated;

create or replace function public.advance_mission_status(
  p_mission_id uuid,
  p_next_status public.mission_status
)
returns public.mission_status
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
  v_assigned uuid;
  v_current public.mission_status;
begin
  select company_id, status into v_company_id, v_current
  from public.missions
  where id = p_mission_id
  for update;

  if v_company_id is null then raise exception 'Mission not found'; end if;

  select professional_id into v_assigned
  from public.mission_assignments
  where mission_id = p_mission_id;

  if auth.uid() <> v_company_id and auth.uid() <> v_assigned then
    raise exception 'Not authorized for this mission';
  end if;

  if p_next_status = 'in_progress' then
    if v_current <> 'confirmed' then
      raise exception 'Only confirmed missions can start';
    end if;
  elsif p_next_status = 'cancelled' then
    if v_current in ('completed', 'cancelled') then
      raise exception 'Mission can no longer be cancelled';
    end if;
    if v_current = 'in_progress' then
      raise exception 'In-progress missions are locked and cannot be cancelled';
    end if;
  elsif p_next_status = 'completed' then
    raise exception 'Use confirm_mission_completion; both parties must confirm';
  else
    raise exception 'Unsupported status transition';
  end if;

  update public.missions
  set status = p_next_status, updated_at = now()
  where id = p_mission_id;

  if v_assigned is not null then
    insert into public.notifications(profile_id, title, body, type, data)
    values (
      case when auth.uid() = v_company_id then v_assigned else v_company_id end,
      case p_next_status when 'in_progress' then 'Mission started' else 'Mission cancelled' end,
      case p_next_status when 'in_progress' then 'The mission is now in progress.' else 'The mission has been cancelled.' end,
      'mission_status',
      jsonb_build_object('mission_id', p_mission_id, 'status', p_next_status, 'email', true)
    );
  end if;

  return p_next_status;
end;
$$;

revoke all on function public.advance_mission_status(uuid, public.mission_status) from public;
grant execute on function public.advance_mission_status(uuid, public.mission_status) to authenticated;
