-- Launch cleanup for the invoice-only billing model.
-- Professional compensation is paid directly by the company outside MediCrew.

create or replace function public.select_mission_professional(p_mission_id uuid, p_professional_id uuid)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_company_id uuid;
  v_match_id uuid;
  v_assignment_id uuid;
  v_status public.mission_status;
begin
  select company_id,status into v_company_id,v_status from public.missions where id=p_mission_id for update;
  if v_company_id is null or v_company_id<>auth.uid() then raise exception 'Not authorized to select a professional'; end if;
  if v_status<>'matching' then raise exception 'Mission is not available for selection'; end if;

  select id into v_match_id from public.mission_matches
  where mission_id=p_mission_id and professional_id=p_professional_id and eligible=true;
  if v_match_id is null then raise exception 'Professional is not an eligible match'; end if;

  if not exists(select 1 from public.professionals where id=p_professional_id and verification_status='verified') then
    raise exception 'Professional is no longer verified';
  end if;

  insert into public.mission_assignments(mission_id,professional_id,confirmed_at)
  values(p_mission_id,p_professional_id,now())
  on conflict(mission_id) do update set professional_id=excluded.professional_id,confirmed_at=now()
  returning id into v_assignment_id;

  update public.missions set status='confirmed',updated_at=now() where id=p_mission_id;
  update public.mission_applications
  set status=case when professional_id=p_professional_id then 'accepted' else 'declined' end
  where mission_id=p_mission_id and status='pending';

  insert into public.conversations(mission_id) values(p_mission_id) on conflict(mission_id) do nothing;
  insert into public.conversation_members(conversation_id,profile_id)
    select c.id,x.profile_id
    from public.conversations c
    cross join (values(auth.uid()),(p_professional_id)) x(profile_id)
    where c.mission_id=p_mission_id
    on conflict do nothing;

  insert into public.notifications(profile_id,title,body,type,data) values
    (p_professional_id,'Mission confirmed','You have been selected for a MediCrew mission. Coordinate payment and mission logistics directly with the company.','mission_confirmed',jsonb_build_object('mission_id',p_mission_id,'email',true)),
    (auth.uid(),'Professional selected','The mission is confirmed. Pay the professional directly according to your agreement; MediCrew will invoice its separate service fee after completion.','professional_selected',jsonb_build_object('mission_id',p_mission_id,'professional_id',p_professional_id,'email',true));

  return v_assignment_id;
end;
$$;
revoke all on function public.select_mission_professional(uuid,uuid) from public;
grant execute on function public.select_mission_professional(uuid,uuid) to authenticated;

create or replace function public.confirm_mission_completion(p_mission_id uuid)
returns public.mission_status
language plpgsql
security definer
set search_path=public
as $$
declare
  v_company_id uuid;
  v_professional_id uuid;
  v_status public.mission_status;
  v_company_done timestamptz;
  v_professional_done timestamptz;
  v_next public.mission_status;
begin
  select m.company_id,m.status,a.professional_id,a.company_completed_at,a.professional_completed_at
    into v_company_id,v_status,v_professional_id,v_company_done,v_professional_done
  from public.missions m
  left join public.mission_assignments a on a.mission_id=m.id
  where m.id=p_mission_id
  for update;

  if v_company_id is null then raise exception 'Mission not found'; end if;
  if auth.uid()<>v_company_id and auth.uid()<>v_professional_id then raise exception 'Not authorized for this mission'; end if;
  if v_status<>'in_progress' then raise exception 'Only in-progress missions can be completed'; end if;
  if v_professional_id is null then raise exception 'Mission has no assigned professional'; end if;

  if auth.uid()=v_company_id then
    update public.mission_assignments set company_completed_at=coalesce(company_completed_at,now()) where mission_id=p_mission_id;
    v_company_done:=coalesce(v_company_done,now());
  else
    update public.mission_assignments set professional_completed_at=coalesce(professional_completed_at,now()) where mission_id=p_mission_id;
    v_professional_done:=coalesce(v_professional_done,now());
  end if;

  if v_company_done is not null and v_professional_done is not null then
    update public.missions set status='completed',updated_at=now() where id=p_mission_id;
    v_next:='completed';

    insert into public.notifications(profile_id,title,body,type,data) values
      (v_company_id,'Mission completed','Both sides confirmed completion. Pay the professional directly if still outstanding, then generate and pay the separate MediCrew service-fee invoice.','mission_completed',jsonb_build_object('mission_id',p_mission_id,'email',true,'url','/company-payments')),
      (v_professional_id,'Mission completed','Both sides confirmed completion. Your compensation is paid directly by the company outside MediCrew.','mission_completed',jsonb_build_object('mission_id',p_mission_id,'email',true));
  else
    v_next:='in_progress';
    insert into public.notifications(profile_id,title,body,type,data)
    values(case when auth.uid()=v_company_id then v_professional_id else v_company_id end,
      'Completion confirmed','The other party confirmed completion. Please confirm when your side is complete.',
      'mission_completion_pending',jsonb_build_object('mission_id',p_mission_id,'email',true));
  end if;

  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(auth.uid(),case when v_next='completed' then 'mission_completed' else 'mission_completion_confirmed' end,'mission',p_mission_id,
    jsonb_build_object('company_confirmed',v_company_done is not null,'professional_confirmed',v_professional_done is not null));

  return v_next;
end;
$$;
revoke all on function public.confirm_mission_completion(uuid) from public;
grant execute on function public.confirm_mission_completion(uuid) to authenticated;

