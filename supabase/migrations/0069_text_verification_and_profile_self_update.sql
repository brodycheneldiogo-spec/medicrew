-- Restore Data API privileges that are required before RLS policies can be evaluated.
-- RLS below still limits every user to their own rows.
grant select, update on public.profiles to authenticated;
grant select, insert, update on public.professionals to authenticated;
grant select, insert, update on public.companies to authenticated;
grant select, insert, update on public.professional_documents to authenticated;
grant select, insert, update on public.company_verification_documents to authenticated;

-- Allow authenticated users to maintain only their own public profile.
drop policy if exists profiles_owner_update on public.profiles;
create policy profiles_owner_update on public.profiles
for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

-- Bio is public profile content for both professionals and organizations.
alter table public.profiles add column if not exists bio text;

-- Company experience can be shown later without changing verification semantics.
alter table public.companies add column if not exists years_experience integer check (years_experience is null or years_experience >= 0);

-- Text-only verification evidence is stored in the existing evidence tables.
-- Files are intentionally optional: MediCrew verifies official references against issuing authorities/registries.
alter table public.professional_documents alter column storage_path drop not null;
alter table public.company_verification_documents alter column storage_path drop not null;

-- Owners may add/update text evidence for review. A user cannot self-verify evidence.
drop policy if exists professional_documents_owner_insert on public.professional_documents;
create policy professional_documents_owner_insert on public.professional_documents
for insert to authenticated
with check (professional_id = (select auth.uid()) and status = 'pending');

drop policy if exists company_verification_documents_owner_insert on public.company_verification_documents;
create policy company_verification_documents_owner_insert on public.company_verification_documents
for insert to authenticated
with check (company_id = (select auth.uid()) and status = 'pending');

drop policy if exists company_verification_documents_owner_update on public.company_verification_documents;
create policy company_verification_documents_owner_update on public.company_verification_documents
for update to authenticated
using (company_id = (select auth.uid()) and status = 'pending')
with check (company_id = (select auth.uid()) and status = 'pending');

-- Submission remains strict, but evidence can now be reference-based rather than uploaded files.
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
    if not exists(select 1 from public.professional_documents d where d.professional_id=v_uid and d.document_type='passport' and d.status in('pending','verified') and nullif(trim(coalesce(d.reference,'')),'') is not null) then raise exception 'Passport reference details are required'; end if;
    if not exists(select 1 from public.professional_documents d where d.professional_id=v_uid and d.document_type='rpps' and d.status in('pending','verified') and nullif(trim(coalesce(d.reference,'')),'') is not null) then raise exception 'Professional licence/registration reference is required'; end if;
    if not exists(select 1 from public.professional_documents d where d.professional_id=v_uid and d.document_type='diploma' and d.status in('pending','verified') and nullif(trim(coalesce(d.reference,'')),'') is not null) then raise exception 'Medical/nursing diploma reference is required'; end if;
    update public.professionals set verification_status='pending',review_submitted_at=now(),updated_at=now() where id=v_uid;
  elsif v_role='company' then
    if not exists(select 1 from public.companies c where c.id=v_uid and nullif(trim(c.registration_country),'') is not null and nullif(trim(c.registration_number),'') is not null) then raise exception 'Official organization registration details are required'; end if;
    if not exists(select 1 from public.company_verification_documents d where d.company_id=v_uid and d.status in('pending','verified') and nullif(trim(coalesce(d.reference,'')),'') is not null) then raise exception 'Official organization registration reference is required'; end if;
    update public.companies set verification_status='pending',review_submitted_at=now(),updated_at=now() where id=v_uid;
  else
    raise exception 'Professional or organization account required';
  end if;

  insert into public.notifications(profile_id,title,body,type,data)
  values(v_uid,'Profile submitted for review',
    'Your MediCrew profile has been created. Our team is reviewing your official reference information. We will email you at '||coalesce(v_email,'your verified email')||' when the review is complete. Review can take up to 24 hours.',
    'verification_submitted',jsonb_build_object('email',true,'url','/pending-review','review_eta_hours',24));

  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(v_uid,'account_submitted_for_review',v_role::text,v_uid,jsonb_build_object('email',v_email,'review_eta_hours',24,'evidence_mode','reference_only'));

  return jsonb_build_object('status','pending','role',v_role,'email',v_email,'review_eta_hours',24);
end;
$$;
revoke all on function public.submit_my_account_for_review() from public;
grant execute on function public.submit_my_account_for_review() to authenticated;

