-- Formal review submission, transactional review notifications, and marketplace access gates.
alter table public.professionals add column if not exists review_submitted_at timestamptz;
alter table public.companies add column if not exists review_submitted_at timestamptz;

create or replace function public.submit_my_account_for_review()
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_uid uuid:=auth.uid();
  v_role public.account_role;
  v_email text;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  select role,email into v_role,v_email from public.profiles where id=v_uid;
  if v_role='professional' then
    if not exists(select 1 from public.professionals p where p.id=v_uid and nullif(trim(p.license_number),'') is not null and nullif(trim(p.license_country),'') is not null and nullif(trim(p.license_authority),'') is not null) then
      raise exception 'Complete professional registration details are required';
    end if;
    if not exists(select 1 from public.professional_documents d where d.professional_id=v_uid and d.document_type='passport' and d.status in('pending','verified')) then raise exception 'Passport evidence is required'; end if;
    if not exists(select 1 from public.professional_documents d where d.professional_id=v_uid and d.document_type='rpps' and d.status in('pending','verified')) then raise exception 'Professional licence/registration evidence is required'; end if;
    if not exists(select 1 from public.professional_documents d where d.professional_id=v_uid and d.document_type='diploma' and d.status in('pending','verified')) then raise exception 'Medical/nursing diploma evidence is required'; end if;
    update public.professionals set verification_status='pending',review_submitted_at=now(),updated_at=now() where id=v_uid;
  elsif v_role='company' then
    if not exists(select 1 from public.companies c where c.id=v_uid and nullif(trim(c.registration_country),'') is not null and nullif(trim(c.registration_number),'') is not null) then raise exception 'Official organization registration details are required'; end if;
    if not exists(select 1 from public.company_verification_documents d where d.company_id=v_uid and d.status in('pending','verified')) then raise exception 'Official organization registration evidence is required'; end if;
    update public.companies set verification_status='pending',review_submitted_at=now(),updated_at=now() where id=v_uid;
  else
    raise exception 'Professional or organization account required';
  end if;

  insert into public.notifications(profile_id,title,body,type,data)
  values(v_uid,'Profile submitted for review',
    'Your MediCrew profile has been created. Our team is reviewing your information and documents. We will email you at '||coalesce(v_email,'your verified email')||' when the review is complete. Review can take up to 24 hours.',
    'verification_submitted',jsonb_build_object('email',true,'url','/pending-review','review_eta_hours',24));

  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(v_uid,'account_submitted_for_review',v_role::text,v_uid,jsonb_build_object('email',v_email,'review_eta_hours',24));

  return jsonb_build_object('status','pending','role',v_role,'email',v_email,'review_eta_hours',24);
end;
$$;
revoke all on function public.submit_my_account_for_review() from public;
grant execute on function public.submit_my_account_for_review() to authenticated;

create or replace function public.my_account_access_state()
returns jsonb
language plpgsql
security definer
set search_path=public
stable
as $$
declare v_uid uuid:=auth.uid();v_role public.account_role;v_status public.verification_status;v_submitted timestamptz;v_email text;
begin
 if v_uid is null then return jsonb_build_object('authenticated',false); end if;
 select role,email into v_role,v_email from public.profiles where id=v_uid;
 if v_role='admin' then return jsonb_build_object('authenticated',true,'role','admin','status','verified','allowed',true,'email',v_email); end if;
 if v_role='professional' then select verification_status,review_submitted_at into v_status,v_submitted from public.professionals where id=v_uid;
 elsif v_role='company' then select verification_status,review_submitted_at into v_status,v_submitted from public.companies where id=v_uid;
 else return jsonb_build_object('authenticated',true,'role',v_role,'status','incomplete','allowed',false,'email',v_email); end if;
 return jsonb_build_object('authenticated',true,'role',v_role,'status',coalesce(v_status::text,'incomplete'),'allowed',v_status='verified','submitted_at',v_submitted,'email',v_email);
end;
$$;
revoke all on function public.my_account_access_state() from public;
grant execute on function public.my_account_access_state() to authenticated;

-- Decision notifications are transactional email + push eligible.
create or replace function public.admin_verify_company(p_company_id uuid, p_status public.verification_status)
returns void language plpgsql security definer set search_path=public as $$
declare v_email text;
begin
 if not exists(select 1 from public.profiles where id=auth.uid() and role='admin') then raise exception 'Admin access required'; end if;
 if p_status not in ('verified','rejected','suspended','pending') then raise exception 'Invalid verification status'; end if;
 if p_status='verified' then
  if not exists(select 1 from public.companies c where c.id=p_company_id and c.review_submitted_at is not null and nullif(trim(c.registration_country),'') is not null and nullif(trim(c.registration_number),'') is not null) then raise exception 'Completed organization review submission is required'; end if;
  if not exists(select 1 from public.company_verification_documents d where d.company_id=p_company_id and d.status='verified') then raise exception 'Verified official organization registration evidence is required'; end if;
 end if;
 update public.companies set verification_status=p_status,updated_at=now() where id=p_company_id;
 select email into v_email from public.profiles where id=p_company_id;
 insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata) values(auth.uid(),'company_verification_changed','company',p_company_id,jsonb_build_object('status',p_status,'evidence_gate',true));
 insert into public.notifications(profile_id,title,body,type,data) values(p_company_id,
  case when p_status='verified' then 'Your organization is verified' when p_status='rejected' then 'Your organization review needs changes' when p_status='suspended' then 'Organization access suspended' else 'Organization review updated' end,
  case when p_status='verified' then 'Your MediCrew organization profile has been approved. You can now access the verified network and publish assignments.' when p_status='rejected' then 'Your MediCrew organization profile could not be approved yet. Open the verification area to review the evidence that needs attention.' when p_status='suspended' then 'Access to the verified MediCrew network has been suspended. Contact MediCrew support for details.' else 'Your MediCrew organization review status was updated.' end,
  'company_verification',jsonb_build_object('status',p_status,'email',true,'url',case when p_status='verified' then '/company' else '/pending-review' end,'recipient_email',v_email));
end;$$;
revoke all on function public.admin_verify_company(uuid,public.verification_status) from public;
grant execute on function public.admin_verify_company(uuid,public.verification_status) to authenticated;

create or replace function public.admin_verify_professional(p_professional_id uuid, p_status public.verification_status)
returns void language plpgsql security definer set search_path=public as $$
declare v_email text;
begin
 if not exists(select 1 from public.profiles where id=auth.uid() and role='admin') then raise exception 'Admin access required'; end if;
 if p_status not in ('verified','rejected','suspended','pending') then raise exception 'Invalid verification status'; end if;
 if p_status='verified' then
  if not exists(select 1 from public.professionals p where p.id=p_professional_id and p.review_submitted_at is not null and nullif(trim(p.license_number),'') is not null and nullif(trim(p.license_country),'') is not null and nullif(trim(p.license_authority),'') is not null and nullif(trim(p.nationality),'') is not null and (p.license_expires_at is null or p.license_expires_at>=current_date)) then raise exception 'Completed professional review submission and valid registration details are required'; end if;
  if not exists(select 1 from public.professional_documents d where d.professional_id=p_professional_id and d.document_type='rpps' and d.status='verified' and (d.expires_at is null or d.expires_at>=current_date)) then raise exception 'Verified professional licence/registration evidence is required'; end if;
  if not exists(select 1 from public.professional_documents d where d.professional_id=p_professional_id and d.document_type='diploma' and d.status='verified') then raise exception 'Verified medical/nursing diploma evidence is required'; end if;
  if not exists(select 1 from public.professional_documents d where d.professional_id=p_professional_id and d.document_type='passport' and d.status='verified' and (d.expires_at is null or d.expires_at>=current_date)) then raise exception 'Verified valid passport evidence is required'; end if;
 end if;
 update public.professionals set verification_status=p_status,updated_at=now() where id=p_professional_id;
 select email into v_email from public.profiles where id=p_professional_id;
 insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata) values(auth.uid(),'professional_verification_changed','professional',p_professional_id,jsonb_build_object('status',p_status,'evidence_gate',true));
 insert into public.notifications(profile_id,title,body,type,data) values(p_professional_id,
  case when p_status='verified' then 'Your professional profile is verified' when p_status='rejected' then 'Your professional review needs changes' when p_status='suspended' then 'Professional access suspended' else 'Professional review updated' end,
  case when p_status='verified' then 'Your MediCrew professional profile has been approved. You can now access missions, the verified network and messaging.' when p_status='rejected' then 'Your MediCrew professional profile could not be approved yet. Open the verification area to review the evidence that needs attention.' when p_status='suspended' then 'Access to the verified MediCrew network has been suspended. Contact MediCrew support for details.' else 'Your MediCrew professional review status was updated.' end,
  'professional_verification',jsonb_build_object('status',p_status,'email',true,'url',case when p_status='verified' then '/home' else '/pending-review' end,'recipient_email',v_email));
end;$$;
revoke all on function public.admin_verify_professional(uuid,public.verification_status) from public;
grant execute on function public.admin_verify_professional(uuid,public.verification_status) to authenticated;

-- Pending/rejected/suspended users cannot browse the verified network or start messages.
create or replace function public.caller_has_verified_network_access()
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.profiles p left join public.professionals pr on pr.id=p.id left join public.companies c on c.id=p.id where p.id=auth.uid() and (p.role='admin' or (p.role='professional' and pr.verification_status='verified' and public.professional_has_current_launch_evidence(p.id)) or (p.role='company' and c.verification_status='verified')))
$$;
revoke all on function public.caller_has_verified_network_access() from public;
grant execute on function public.caller_has_verified_network_access() to authenticated;

create or replace function public.start_direct_conversation(p_target_profile uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid;v_me public.account_role;v_target public.account_role;
begin
 if not public.caller_has_verified_network_access() then raise exception 'Verified MediCrew access required'; end if;
 if auth.uid() is null or p_target_profile=auth.uid() then raise exception 'Invalid conversation target'; end if;
 select role into v_me from public.profiles where id=auth.uid();select role into v_target from public.profiles where id=p_target_profile;
 if v_target is null then raise exception 'Profile not found'; end if;
 if v_me='company' and v_target='company' then raise exception 'Organization-to-organization messaging is not supported'; end if;
 if v_target='professional' and not exists(select 1 from public.professionals where id=p_target_profile and verification_status='verified') then raise exception 'Target professional is not verified'; end if;
 if v_target='company' and not exists(select 1 from public.companies where id=p_target_profile and verification_status='verified') then raise exception 'Target organization is not verified'; end if;
 select c.id into v_id from public.direct_conversations c where exists(select 1 from public.direct_conversation_members a where a.conversation_id=c.id and a.profile_id=auth.uid()) and exists(select 1 from public.direct_conversation_members b where b.conversation_id=c.id and b.profile_id=p_target_profile) and 2=(select count(*) from public.direct_conversation_members z where z.conversation_id=c.id) limit 1;
 if v_id is null then insert into public.direct_conversations default values returning id into v_id;insert into public.direct_conversation_members(conversation_id,profile_id) values(v_id,auth.uid()),(v_id,p_target_profile);end if;return v_id;
end;$$;
revoke all on function public.start_direct_conversation(uuid) from public;
grant execute on function public.start_direct_conversation(uuid) to authenticated;

