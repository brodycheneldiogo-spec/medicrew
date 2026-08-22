-- Document-first professional verification, optional unverified contact phone,
-- exact calendar grants, and assignment-scoped access to bank details.

grant select,insert on table public.legal_acceptances to authenticated;
revoke update,delete,truncate on table public.legal_acceptances from anon,authenticated;

revoke all on function public.set_my_available_days(date[]) from public,anon;
grant execute on function public.set_my_available_days(date[]) to authenticated;
grant select,insert,delete on table public.professional_available_days to authenticated;

alter table public.professional_documents drop constraint if exists professional_documents_document_type_check;
alter table public.professional_documents add constraint professional_documents_document_type_check
check(document_type in('identity','passport','rpps','professional_card','cv','rcp_insurance','diploma','certificate','bank_details','other'));

create or replace function public.protect_profile_identity_fields()
returns trigger language plpgsql security definer set search_path=public,auth as $$
declare v_email text;v_email_confirmed timestamptz;v_actor_is_admin boolean:=false;
begin
 select exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin') into v_actor_is_admin;
 if auth.uid()=old.id and not v_actor_is_admin then
  new.role:=old.role;
  select u.email,u.email_confirmed_at into v_email,v_email_confirmed from auth.users u where u.id=old.id;
  new.email:=case when v_email_confirmed is not null then v_email else old.email end;
  if nullif(trim(coalesce(new.phone,'')),'') is not null and new.phone !~ '^\+[1-9][0-9]{6,14}$' then
   raise exception 'Use an international phone number such as +33612345678';
  end if;
 end if;
 return new;
end;$$;
revoke all on function public.protect_profile_identity_fields() from public,anon,authenticated;

drop policy if exists professional_documents_storage_select on storage.objects;
create policy professional_documents_storage_select on storage.objects for select to authenticated
using(bucket_id='professional-documents' and (
 (storage.foldername(name))[1]=(select auth.uid())::text
 or exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin')
 or exists(
  select 1 from public.professional_documents d
  join public.mission_applications a on a.professional_id=d.professional_id and a.status='accepted'
  join public.missions m on m.id=a.mission_id
  where d.storage_path=storage.objects.name and d.document_type='bank_details' and m.company_id=(select auth.uid())
 )
));

create or replace function public.submit_my_account_for_review()
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_uid uuid:=auth.uid();v_role public.account_role;v_email text;v_type text;
begin
 if v_uid is null then raise exception 'Authentication required'; end if;
 select role,email into v_role,v_email from public.profiles where id=v_uid;
 if v_role='professional' then
  if not exists(select 1 from public.professionals p where p.id=v_uid and coalesce(p.years_experience,0)>=0 and nullif(trim(p.base_city),'') is not null and nullif(trim(p.country_of_operation),'') is not null and p.base_airport_code ~ '^[A-Z]{3}$') then raise exception 'Complete professional profile details are required'; end if;
  foreach v_type in array array['passport','cv','professional_card','diploma','bank_details'] loop
   if not exists(select 1 from public.professional_documents d where d.professional_id=v_uid and d.document_type=v_type and d.status in('pending','verified') and nullif(trim(coalesce(d.storage_path,'')),'') is not null) then raise exception 'Missing required document: %',v_type; end if;
  end loop;
  update public.professionals set verification_status='pending',review_submitted_at=now(),updated_at=now() where id=v_uid;
 elsif v_role='company' then
  if not exists(select 1 from public.company_verification_documents d where d.company_id=v_uid and d.status in('pending','verified') and nullif(trim(coalesce(d.storage_path,'')),'') is not null) then raise exception 'Add one organization document'; end if;
  update public.companies set verification_status='pending',review_submitted_at=now(),updated_at=now() where id=v_uid;
 else raise exception 'Professional or organization account required'; end if;
 insert into public.notifications(profile_id,title,body,type,data) values(v_uid,'Profile submitted for review','Your MediCrew profile and documents are being reviewed. We will email and notify you when the review is complete.','verification_submitted',jsonb_build_object('email',true,'url','/pending-review','review_eta_hours',24));
 insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata) values(v_uid,'account_submitted_for_review',v_role::text,v_uid,jsonb_build_object('email',v_email,'evidence_mode','uploaded_documents'));
 return jsonb_build_object('status','pending','role',v_role,'email',v_email,'review_eta_hours',24);
end;$$;
revoke all on function public.submit_my_account_for_review() from public,anon;
grant execute on function public.submit_my_account_for_review() to authenticated;

create or replace function public.auto_submit_professional_review()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_submitted timestamptz;v_status public.verification_status;
begin
 if new.document_type not in('passport','cv','professional_card','diploma','bank_details') then return new; end if;
 select review_submitted_at,verification_status into v_submitted,v_status from public.professionals where id=new.professional_id;
 if v_submitted is not null and v_status<>'rejected' then return new; end if;
 if (select count(distinct document_type)=5 from public.professional_documents where professional_id=new.professional_id and document_type in('passport','cv','professional_card','diploma','bank_details') and status in('pending','verified') and nullif(trim(coalesce(storage_path,'')),'') is not null) then perform public.submit_my_account_for_review(); end if;
 return new;
end;$$;
revoke all on function public.auto_submit_professional_review() from public,anon,authenticated;

create or replace function public.admin_verify_professional(p_professional_id uuid,p_status public.verification_status)
returns void language plpgsql security definer set search_path=public as $$
declare v_email text;v_type text;
begin
 if not exists(select 1 from public.profiles where id=auth.uid() and role='admin') then raise exception 'Admin access required'; end if;
 if p_status not in('verified','rejected','suspended','pending') then raise exception 'Invalid verification status'; end if;
 if p_status='verified' then
  foreach v_type in array array['passport','cv','professional_card','diploma','bank_details'] loop
   if not exists(select 1 from public.professional_documents d where d.professional_id=p_professional_id and d.document_type=v_type and d.status='verified' and nullif(trim(coalesce(d.storage_path,'')),'') is not null) then raise exception 'Verify required document first: %',v_type; end if;
  end loop;
 end if;
 update public.professionals set verification_status=p_status,updated_at=now() where id=p_professional_id;
 select email into v_email from public.profiles where id=p_professional_id;
 insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata) values(auth.uid(),'professional_verification_changed','professional',p_professional_id,jsonb_build_object('status',p_status,'evidence_gate','five_documents'));
 insert into public.notifications(profile_id,title,body,type,data) values(p_professional_id,case when p_status='verified' then 'Your professional profile is verified' else 'Your professional review was updated' end,case when p_status='verified' then 'Your MediCrew professional file has been approved.' else 'Open MediCrew to review your professional file.' end,'professional_verification',jsonb_build_object('status',p_status,'email',true,'url','/pending-review','recipient_email',v_email));
end;$$;
revoke all on function public.admin_verify_professional(uuid,public.verification_status) from public,anon;
grant execute on function public.admin_verify_professional(uuid,public.verification_status) to authenticated;
