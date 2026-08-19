-- Final marketplace model: avatars, company evidence, direct payments, and verification gates.

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('avatars','avatars',true,5242880,array['image/jpeg','image/png','image/webp']::text[])
on conflict(id) do update set public=true,file_size_limit=5242880,allowed_mime_types=array['image/jpeg','image/png','image/webp']::text[];

drop policy if exists avatars_owner_insert on storage.objects;
drop policy if exists avatars_owner_update on storage.objects;
drop policy if exists avatars_owner_delete on storage.objects;
create policy avatars_owner_insert on storage.objects for insert to authenticated with check(bucket_id='avatars' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy avatars_owner_update on storage.objects for update to authenticated using(bucket_id='avatars' and (storage.foldername(name))[1]=(select auth.uid())::text) with check(bucket_id='avatars' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy avatars_owner_delete on storage.objects for delete to authenticated using(bucket_id='avatars' and (storage.foldername(name))[1]=(select auth.uid())::text);

create table if not exists public.company_verification_documents(
 id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id) on delete cascade,
 document_type text not null default 'company_registration',title text not null,reference text,storage_path text,
 original_name text,mime_type text,size_bytes bigint,status public.document_status not null default 'pending',
 rejection_reason text,uploaded_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index if not exists company_verification_documents_company_idx on public.company_verification_documents(company_id,created_at desc);
create index if not exists company_verification_documents_status_idx on public.company_verification_documents(status,created_at desc);
alter table public.company_verification_documents enable row level security;
drop policy if exists company_verification_documents_owner_select on public.company_verification_documents;
drop policy if exists company_verification_documents_owner_insert on public.company_verification_documents;
create policy company_verification_documents_owner_select on public.company_verification_documents for select to authenticated using(company_id=(select auth.uid()));
create policy company_verification_documents_owner_insert on public.company_verification_documents for insert to authenticated with check(company_id=(select auth.uid()) and status='pending');

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('company-documents','company-documents',false,10485760,array['application/pdf','image/jpeg','image/png','image/webp']::text[])
on conflict(id) do update set public=false,file_size_limit=10485760,allowed_mime_types=array['application/pdf','image/jpeg','image/png','image/webp']::text[];
drop policy if exists company_documents_storage_insert on storage.objects;
drop policy if exists company_documents_storage_select on storage.objects;
drop policy if exists company_documents_storage_delete on storage.objects;
create policy company_documents_storage_insert on storage.objects for insert to authenticated with check(bucket_id='company-documents' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy company_documents_storage_select on storage.objects for select to authenticated using(bucket_id='company-documents' and ((storage.foldername(name))[1]=(select auth.uid())::text or exists(select 1 from public.profiles where id=(select auth.uid()) and role='admin')));
create policy company_documents_storage_delete on storage.objects for delete to authenticated using(bucket_id='company-documents' and ((storage.foldername(name))[1]=(select auth.uid())::text or exists(select 1 from public.profiles where id=(select auth.uid()) and role='admin')));

create or replace function public.admin_company_verification_queue() returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb; begin
 if not exists(select 1 from public.profiles where id=auth.uid() and role='admin') then raise exception 'Admin access required'; end if;
 select coalesce(jsonb_agg(row_to_json(x) order by x.created_at desc),'[]'::jsonb) into result from(
  select d.*,c.company_name,c.siret,c.siren,c.organization_type from public.company_verification_documents d join public.companies c on c.id=d.company_id where d.status in('pending','expired')
 )x; return jsonb_build_object('documents',result); end; $$;
revoke all on function public.admin_company_verification_queue() from public; grant execute on function public.admin_company_verification_queue() to authenticated;

create or replace function public.admin_verify_company_document(p_document_id uuid,p_status public.document_status,p_reason text default null) returns void language plpgsql security definer set search_path=public as $$
declare v_company uuid; begin
 if not exists(select 1 from public.profiles where id=auth.uid() and role='admin') then raise exception 'Admin access required'; end if;
 select company_id into v_company from public.company_verification_documents where id=p_document_id; if v_company is null then raise exception 'Company document not found'; end if;
 update public.company_verification_documents set status=p_status,rejection_reason=case when p_status='rejected' then nullif(trim(p_reason),'') else null end,updated_at=now() where id=p_document_id;
 insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata) values(auth.uid(),'company_document_verification_changed','company_verification_document',p_document_id,jsonb_build_object('company_id',v_company,'status',p_status));
 insert into public.notifications(profile_id,title,body,type,data) values(v_company,'Company document reviewed','A MediCrew administrator reviewed a company verification document.','company_document_verification',jsonb_build_object('document_id',p_document_id,'status',p_status)); end; $$;
revoke all on function public.admin_verify_company_document(uuid,public.document_status,text) from public; grant execute on function public.admin_verify_company_document(uuid,public.document_status,text) to authenticated;

create or replace function public.admin_verify_company(p_company_id uuid,p_status public.verification_status) returns void language plpgsql security definer set search_path=public as $$
begin
 if not exists(select 1 from public.profiles where id=auth.uid() and role='admin') then raise exception 'Admin access required'; end if;
 if p_status='verified' and not exists(select 1 from public.company_verification_documents where company_id=p_company_id and status='verified') then raise exception 'Verify at least one company registration document before verifying the company'; end if;
 update public.companies set verification_status=p_status,updated_at=now() where id=p_company_id;
 insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata) values(auth.uid(),'company_verification_changed','company',p_company_id,jsonb_build_object('status',p_status));
 insert into public.notifications(profile_id,title,body,type,data) values(p_company_id,'Company verification updated','Your MediCrew company verification status was updated.','company_verification',jsonb_build_object('status',p_status)); end; $$;
revoke all on function public.admin_verify_company(uuid,public.verification_status) from public; grant execute on function public.admin_verify_company(uuid,public.verification_status) to authenticated;

create or replace function public.admin_verify_professional(p_professional_id uuid,p_status public.verification_status) returns void language plpgsql security definer set search_path=public as $$
begin
 if not exists(select 1 from public.profiles where id=auth.uid() and role='admin') then raise exception 'Admin access required'; end if;
 if p_status='verified' and not exists(select 1 from public.professional_documents where professional_id=p_professional_id and document_type='identity' and status='verified') then raise exception 'Verify an identity document before verifying the professional'; end if;
 if p_status='verified' and not exists(select 1 from public.professional_documents where professional_id=p_professional_id and document_type='rpps' and status='verified') then raise exception 'Verify a professional registration document before verifying the professional'; end if;
 update public.professionals set verification_status=p_status,updated_at=now() where id=p_professional_id;
 insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata) values(auth.uid(),'professional_verification_changed','professional',p_professional_id,jsonb_build_object('status',p_status));
 insert into public.notifications(profile_id,title,body,type,data) values(p_professional_id,'Professional verification updated','Your MediCrew verification status was updated.','professional_verification',jsonb_build_object('status',p_status)); end; $$;
revoke all on function public.admin_verify_professional(uuid,public.verification_status) from public; grant execute on function public.admin_verify_professional(uuid,public.verification_status) to authenticated;

drop function if exists public.company_mission_matches(uuid);

create function public.company_mission_matches(p_mission_id uuid) returns table(match_id uuid,professional_id uuid,first_name text,last_name text,avatar_url text,professional_type public.professional_type,specialty text,years_experience integer,medical_transport_years numeric,air_ambulance_years numeric,verification_status public.verification_status,score numeric,eligible boolean,reasons text[]) language sql security definer set search_path=public as $$
 select mm.id,p.id,pr.first_name,pr.last_name,pr.avatar_url,p.professional_type,p.specialty,p.years_experience,p.medical_transport_years,p.air_ambulance_years,p.verification_status,mm.score,mm.eligible,mm.reasons
 from public.mission_matches mm join public.missions m on m.id=mm.mission_id join public.professionals p on p.id=mm.professional_id join public.profiles pr on pr.id=p.id
 where mm.mission_id=p_mission_id and m.company_id=auth.uid() and mm.eligible=true order by mm.score desc; $$;
revoke all on function public.company_mission_matches(uuid) from public; grant execute on function public.company_mission_matches(uuid) to authenticated;

drop trigger if exists mission_payment_after_completion on public.missions;
alter table public.missions alter column platform_fee_cents set default 0;
update public.missions set platform_fee_cents=0 where platform_fee_cents<>0;
create or replace function public.mission_payment_model() returns jsonb language sql immutable as $$ select jsonb_build_object('provider','direct','platform_collects_mission_funds',false,'professional_fee_displayed',true,'message','Mission compensation is agreed and paid directly between the company and the professional. MediCrew does not hold, release or transfer mission compensation.') $$;
revoke all on function public.mission_payment_model() from public; grant execute on function public.mission_payment_model() to authenticated;
