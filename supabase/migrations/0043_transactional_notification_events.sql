-- Make mission selection and payment events eligible for transactional email delivery.
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
  select id into v_match_id from public.mission_matches where mission_id=p_mission_id and professional_id=p_professional_id and eligible=true;
  if v_match_id is null then raise exception 'Professional is not an eligible match'; end if;
  if not exists(select 1 from public.professionals where id=p_professional_id and verification_status='verified') then raise exception 'Professional is no longer verified'; end if;
  insert into public.mission_assignments(mission_id,professional_id,confirmed_at) values(p_mission_id,p_professional_id,now())
    on conflict(mission_id) do update set professional_id=excluded.professional_id,confirmed_at=now() returning id into v_assignment_id;
  update public.missions set status='confirmed',updated_at=now() where id=p_mission_id;
  update public.mission_applications set status=case when professional_id=p_professional_id then 'accepted' else 'declined' end where mission_id=p_mission_id and status='pending';
  insert into public.conversations(mission_id) values(p_mission_id) on conflict(mission_id) do nothing;
  insert into public.conversation_members(conversation_id,profile_id)
    select c.id,x.profile_id from public.conversations c cross join (values(auth.uid()),(p_professional_id)) x(profile_id)
    where c.mission_id=p_mission_id on conflict do nothing;
  insert into public.notifications(profile_id,title,body,type,data) values
    (p_professional_id,'Mission confirmed','You have been selected for a MediCrew mission.','mission_confirmed',jsonb_build_object('mission_id',p_mission_id,'email',true)),
    (auth.uid(),'Professional selected','The mission is now confirmed. Pay the mission through MediCrew before it starts.','professional_selected',jsonb_build_object('mission_id',p_mission_id,'professional_id',p_professional_id,'email',true));
  return v_assignment_id;
end;
$$;
revoke all on function public.select_mission_professional(uuid,uuid) from public;
grant execute on function public.select_mission_professional(uuid,uuid) to authenticated;
