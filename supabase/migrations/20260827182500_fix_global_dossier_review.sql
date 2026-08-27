create or replace function public.admin_verify_professional(
  p_professional_id uuid,
  p_status public.verification_status
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  ) then
    raise exception 'Admin access required';
  end if;

  if p_status not in ('verified', 'rejected') then
    raise exception 'Invalid verification status';
  end if;

  update public.professionals
  set verification_status = p_status, updated_at = now()
  where id = p_professional_id;

  if not found then
    raise exception 'Professional dossier not found';
  end if;

  update public.professional_documents
  set status = p_status::text::public.document_status,
      rejection_reason = case when p_status = 'rejected'
        then 'Dossier refusé par MediCrew.' else null end,
      verified_at = case when p_status = 'verified' then now() else null end,
      verified_by = case when p_status = 'verified' then (select auth.uid()) else null end,
      updated_at = now()
  where professional_id = p_professional_id;

  update public.professional_certifications
  set status = p_status::text::public.document_status
  where professional_id = p_professional_id;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values ((select auth.uid()), 'professional_verification_changed', 'professional',
          p_professional_id, jsonb_build_object('status', p_status, 'whole_file', true));

  insert into public.notifications(profile_id, title, body, type, data)
  values (
    p_professional_id,
    case when p_status = 'verified' then 'Dossier accepté' else 'Dossier refusé' end,
    case when p_status = 'verified'
      then 'Votre dossier professionnel MediCrew a été accepté.'
      else 'Votre dossier professionnel MediCrew a été refusé.' end,
    'professional_verification',
    jsonb_build_object('status', p_status)
  );
end;
$function$;

create or replace function public.admin_verify_company(
  p_company_id uuid,
  p_status public.verification_status
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  ) then
    raise exception 'Admin access required';
  end if;

  if p_status not in ('verified', 'rejected') then
    raise exception 'Invalid verification status';
  end if;

  update public.companies
  set verification_status = p_status, updated_at = now()
  where id = p_company_id;

  if not found then
    raise exception 'Company dossier not found';
  end if;

  update public.company_verification_documents
  set status = p_status::text::public.document_status,
      rejection_reason = case when p_status = 'rejected'
        then 'Dossier refusé par MediCrew.' else null end,
      updated_at = now()
  where company_id = p_company_id;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values ((select auth.uid()), 'company_verification_changed', 'company',
          p_company_id, jsonb_build_object('status', p_status, 'whole_file', true));

  insert into public.notifications(profile_id, title, body, type, data)
  values (
    p_company_id,
    case when p_status = 'verified' then 'Dossier accepté' else 'Dossier refusé' end,
    case when p_status = 'verified'
      then 'Votre dossier entreprise MediCrew a été accepté.'
      else 'Votre dossier entreprise MediCrew a été refusé.' end,
    'company_verification',
    jsonb_build_object('status', p_status)
  );
end;
$function$;

revoke execute on function public.admin_verify_professional(uuid, public.verification_status)
  from public, anon;
revoke execute on function public.admin_verify_company(uuid, public.verification_status)
  from public, anon;
grant execute on function public.admin_verify_professional(uuid, public.verification_status)
  to authenticated;
grant execute on function public.admin_verify_company(uuid, public.verification_status)
  to authenticated;
