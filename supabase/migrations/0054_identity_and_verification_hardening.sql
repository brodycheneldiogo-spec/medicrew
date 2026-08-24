-- Identity and verification hardening for launch.
-- 1) Users cannot self-promote roles or forge verified contact data in public.profiles.
-- 2) Admin verification of professionals/organizations requires verified evidence.

create or replace function public.protect_profile_identity_fields()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_email text;
  v_phone text;
  v_email_confirmed timestamptz;
  v_phone_confirmed timestamptz;
  v_actor_is_admin boolean := false;
begin
  select exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin') into v_actor_is_admin;

  if auth.uid() = old.id and not v_actor_is_admin then
    -- Role is authorization state and can never be changed by the account owner.
    new.role := old.role;

    -- Public contact fields must mirror confirmed Supabase Auth values rather than arbitrary client input.
    select u.email,u.phone,u.email_confirmed_at,u.phone_confirmed_at
      into v_email,v_phone,v_email_confirmed,v_phone_confirmed
    from auth.users u where u.id=old.id;

    new.email := case when v_email_confirmed is not null then v_email else old.email end;
    new.phone := case when v_phone_confirmed is not null then v_phone else old.phone end;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_protect_identity_fields on public.profiles;
create trigger profiles_protect_identity_fields
before update on public.profiles
for each row execute function public.protect_profile_identity_fields();

create or replace function public.admin_verify_company(p_company_id uuid, p_status public.verification_status)
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  if not exists(select 1 from public.profiles where id=auth.uid() and role='admin') then
    raise exception 'Admin access required';
  end if;
  if p_status not in ('verified','rejected','suspended','pending') then
    raise exception 'Invalid verification status';
  end if;

  if p_status='verified' then
    if not exists(
      select 1 from public.companies c
      where c.id=p_company_id
        and nullif(trim(c.registration_country),'') is not null
        and nullif(trim(c.registration_number),'') is not null
    ) then
      raise exception 'Registration country and official registration number are required before verification';
    end if;
    if not exists(
      select 1 from public.company_verification_documents d
      where d.company_id=p_company_id and d.status='verified'
    ) then
      raise exception 'At least one official organization registration document must be verified first';
    end if;
  end if;

  update public.companies set verification_status=p_status,updated_at=now() where id=p_company_id;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(auth.uid(),'company_verification_changed','company',p_company_id,jsonb_build_object('status',p_status,'evidence_gate',true));
  insert into public.notifications(profile_id,title,body,type,data)
  values(p_company_id,'Organization verification updated','Your MediCrew organization verification status was updated.','company_verification',jsonb_build_object('status',p_status));
end;
$$;

grant execute on function public.admin_verify_company(uuid,public.verification_status) to authenticated;

create or replace function public.admin_verify_professional(p_professional_id uuid, p_status public.verification_status)
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  if not exists(select 1 from public.profiles where id=auth.uid() and role='admin') then
    raise exception 'Admin access required';
  end if;
  if p_status not in ('verified','rejected','suspended','pending') then
    raise exception 'Invalid verification status';
  end if;

  if p_status='verified' then
    if not exists(
      select 1 from public.professionals p
      where p.id=p_professional_id
        and nullif(trim(p.license_number),'') is not null
        and nullif(trim(p.license_country),'') is not null
        and nullif(trim(p.license_authority),'') is not null
        and nullif(trim(p.nationality),'') is not null
        and (p.license_expires_at is null or p.license_expires_at>=current_date)
    ) then
      raise exception 'Complete valid professional registration details are required before verification';
    end if;

    if not exists(
      select 1 from public.professional_documents d
      where d.professional_id=p_professional_id
        and d.document_type='rpps'
        and d.status='verified'
        and (d.expires_at is null or d.expires_at>=current_date)
    ) then
      raise exception 'Verified professional licence/registration evidence is required';
    end if;

    if not exists(
      select 1 from public.professional_documents d
      where d.professional_id=p_professional_id
        and d.document_type='diploma'
        and d.status='verified'
    ) then
      raise exception 'Verified medical/nursing diploma evidence is required';
    end if;

    if not exists(
      select 1 from public.professional_documents d
      where d.professional_id=p_professional_id
        and d.document_type='passport'
        and d.status='verified'
        and (d.expires_at is null or d.expires_at>=current_date)
    ) then
      raise exception 'Verified valid passport evidence is required';
    end if;
  end if;

  update public.professionals set verification_status=p_status,updated_at=now() where id=p_professional_id;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(auth.uid(),'professional_verification_changed','professional',p_professional_id,jsonb_build_object('status',p_status,'evidence_gate',true));
  insert into public.notifications(profile_id,title,body,type,data)
  values(p_professional_id,'Professional verification updated','Your MediCrew professional verification status was updated.','professional_verification',jsonb_build_object('status',p_status));
end;
$$;

grant execute on function public.admin_verify_professional(uuid,public.verification_status) to authenticated;

-- A professional whose verified evidence expires is automatically no longer eligible for marketplace verification.
create or replace function public.professional_has_current_launch_evidence(p_professional_id uuid)
returns boolean
language sql
security definer
set search_path=public
stable
as $$
  select exists(
    select 1 from public.professionals p
    where p.id=p_professional_id
      and p.verification_status='verified'
      and (p.license_expires_at is null or p.license_expires_at>=current_date)
      and exists(select 1 from public.professional_documents d where d.professional_id=p.id and d.document_type='rpps' and d.status='verified' and (d.expires_at is null or d.expires_at>=current_date))
      and exists(select 1 from public.professional_documents d where d.professional_id=p.id and d.document_type='diploma' and d.status='verified')
      and exists(select 1 from public.professional_documents d where d.professional_id=p.id and d.document_type='passport' and d.status='verified' and (d.expires_at is null or d.expires_at>=current_date))
  );
$$;

revoke all on function public.professional_has_current_launch_evidence(uuid) from public;
grant execute on function public.professional_has_current_launch_evidence(uuid) to authenticated;

