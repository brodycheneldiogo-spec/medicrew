-- Admin operations: all verification and suspension mutations stay server-side.
create or replace function public.admin_verify_company(p_company_id uuid, p_status public.verification_status)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not exists (select 1 from public.profiles where id=auth.uid() and role='admin') then raise exception 'Admin access required'; end if;
  if p_status not in ('verified','rejected','suspended','pending') then raise exception 'Invalid verification status'; end if;
  update public.companies set verification_status=p_status, updated_at=now() where id=p_company_id;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata) values(auth.uid(),'company_verification_changed','company',p_company_id,jsonb_build_object('status',p_status));
  insert into public.notifications(profile_id,title,body,type,data) values(p_company_id,'Company verification updated','Your MediCrew company verification status was updated.','company_verification',jsonb_build_object('status',p_status));
end; $$;

grant execute on function public.admin_verify_company(uuid, public.verification_status) to authenticated;

create or replace function public.admin_verify_professional(p_professional_id uuid, p_status public.verification_status)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not exists (select 1 from public.profiles where id=auth.uid() and role='admin') then raise exception 'Admin access required'; end if;
  update public.professionals set verification_status=p_status, updated_at=now() where id=p_professional_id;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata) values(auth.uid(),'professional_verification_changed','professional',p_professional_id,jsonb_build_object('status',p_status));
  insert into public.notifications(profile_id,title,body,type,data) values(p_professional_id,'Professional verification updated','Your MediCrew verification status was updated.','professional_verification',jsonb_build_object('status',p_status));
end; $$;

grant execute on function public.admin_verify_professional(uuid, public.verification_status) to authenticated;

create or replace function public.admin_suspend_profile(p_profile_id uuid, p_reason text)
returns void language plpgsql security definer set search_path=public as $$
declare v_role public.account_role;
begin
  if not exists (select 1 from public.profiles where id=auth.uid() and role='admin') then raise exception 'Admin access required'; end if;
  select role into v_role from public.profiles where id=p_profile_id;
  if v_role='professional' then update public.professionals set verification_status='suspended',updated_at=now() where id=p_profile_id;
  elsif v_role='company' then update public.companies set verification_status='suspended',updated_at=now() where id=p_profile_id;
  else raise exception 'Cannot suspend an admin'; end if;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata) values(auth.uid(),'profile_suspended','profile',p_profile_id,jsonb_build_object('reason',coalesce(p_reason,'')));
end; $$;

grant execute on function public.admin_suspend_profile(uuid,text) to authenticated;
