-- A mission may be cancelled before it starts, but an in-progress mission is locked.
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
    if v_current='draft' and auth.uid()<>v_company_id then raise exception 'Only the company can cancel a draft mission'; end if;
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