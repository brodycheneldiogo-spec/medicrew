-- Both sides must confirm completion before a mission becomes completed.
alter table public.mission_assignments
  add column if not exists company_completed_at timestamptz,
  add column if not exists professional_completed_at timestamptz;

create or replace function public.confirm_mission_completion(p_mission_id uuid)
returns public.mission_status
language plpgsql security definer set search_path=public
as $$
declare
  v_company_id uuid;
  v_professional_id uuid;
  v_status public.mission_status;
  v_company_done timestamptz;
  v_professional_done timestamptz;
  v_next public.mission_status;
  v_now timestamptz := now();
begin
  -- Lock the mission first. This avoids locking the nullable side of an outer join.
  select company_id,status into v_company_id,v_status
  from public.missions where id=p_mission_id for update;
  if v_company_id is null then raise exception 'Mission not found'; end if;

  select professional_id,company_completed_at,professional_completed_at
    into v_professional_id,v_company_done,v_professional_done
  from public.mission_assignments
  where mission_id=p_mission_id
  for update;

  if auth.uid()<>v_company_id and auth.uid()<>v_professional_id then raise exception 'Not authorized for this mission'; end if;
  if v_status<>'in_progress' then raise exception 'Only in-progress missions can be completed'; end if;
  if v_professional_id is null then raise exception 'Mission has no assigned professional'; end if;

  if auth.uid()=v_company_id then
    update public.mission_assignments set company_completed_at=coalesce(company_completed_at,v_now) where mission_id=p_mission_id;
    v_company_done:=coalesce(v_company_done,v_now);
  else
    update public.mission_assignments set professional_completed_at=coalesce(professional_completed_at,v_now) where mission_id=p_mission_id;
    v_professional_done:=coalesce(v_professional_done,v_now);
  end if;

  if v_company_done is not null and v_professional_done is not null then
    update public.missions set status='completed',updated_at=v_now where id=p_mission_id;
    v_next:='completed';
    insert into public.notifications(profile_id,title,body,type,data) values
      (v_company_id,'Mission completed','Both sides confirmed completion of the MediCrew mission.','mission_completed',jsonb_build_object('mission_id',p_mission_id)),
      (v_professional_id,'Mission completed','Both sides confirmed completion of the MediCrew mission.','mission_completed',jsonb_build_object('mission_id',p_mission_id));
  else
    v_next:='in_progress';
    insert into public.notifications(profile_id,title,body,type,data)
    values(case when auth.uid()=v_company_id then v_professional_id else v_company_id end,
      'Completion confirmed','The other party confirmed completion. Please confirm when your side is complete.','mission_completion_pending',jsonb_build_object('mission_id',p_mission_id));
  end if;

  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(auth.uid(),case when v_next='completed' then 'mission_completed' else 'mission_completion_confirmed' end,'mission',p_mission_id,
    jsonb_build_object('company_confirmed',v_company_done is not null,'professional_confirmed',v_professional_done is not null));
  return v_next;
end;
$$;
revoke all on function public.confirm_mission_completion(uuid) from public;
grant execute on function public.confirm_mission_completion(uuid) to authenticated;

create or replace function public.advance_mission_status(p_mission_id uuid,p_next_status public.mission_status)
returns public.mission_status
language plpgsql security definer set search_path=public as $$
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