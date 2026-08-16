-- Harden verification records and allow professionals to submit certifications.

-- The professional must never be able to change the verification decision itself.
drop policy if exists professional_documents_owner_update on public.professional_documents;

-- Certification submission belongs to the professional; verification remains admin-only.
drop policy if exists professional_certifications_owner_select on public.professional_certifications;
create policy professional_certifications_owner_select on public.professional_certifications
  for select to authenticated using (professional_id=auth.uid());

drop policy if exists professional_certifications_owner_insert on public.professional_certifications;
create policy professional_certifications_owner_insert on public.professional_certifications
  for insert to authenticated
  with check (professional_id=auth.uid());

create or replace function public.admin_verify_certification(
  p_certification_id uuid,
  p_status public.document_status
)
returns void
language plpgsql security definer set search_path=public
as $$
declare v_professional uuid;
begin
  if not exists(select 1 from public.profiles where id=auth.uid() and role='admin') then
    raise exception 'Admin access required';
  end if;
  select professional_id into v_professional from public.professional_certifications where id=p_certification_id;
  if v_professional is null then raise exception 'Certification not found'; end if;
  if p_status not in ('verified','rejected','pending','expired') then raise exception 'Invalid certification status'; end if;

  update public.professional_certifications
  set status=p_status
  where id=p_certification_id;

  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(auth.uid(),'professional_certification_verification_changed','professional_certification',p_certification_id,
         jsonb_build_object('professional_id',v_professional,'status',p_status));
  insert into public.notifications(profile_id,title,body,type,data)
  values(v_professional,'Certification verification updated','A MediCrew administrator updated your certification verification status.','certification_verification',
         jsonb_build_object('certification_id',p_certification_id,'status',p_status));
end;
$$;
grant execute on function public.admin_verify_certification(uuid,public.document_status) to authenticated;
