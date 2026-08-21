-- Verified evidence is immutable for account owners. A changed credential must be re-submitted and re-reviewed.

create or replace function public.force_company_pending_on_insert()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  new.verification_status := 'pending';
  return new;
end;
$$;
drop trigger if exists companies_force_pending_insert on public.companies;
create trigger companies_force_pending_insert
before insert on public.companies
for each row execute function public.force_company_pending_on_insert();

create or replace function public.protect_professional_document_verification_fields()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if auth.uid()=old.professional_id and not exists(select 1 from public.profiles where id=auth.uid() and role='admin') then
    if old.status='verified' and (
      new.document_type is distinct from old.document_type or
      new.title is distinct from old.title or
      new.reference is distinct from old.reference or
      new.expires_at is distinct from old.expires_at or
      new.storage_path is distinct from old.storage_path
    ) then
      raise exception 'Verified evidence cannot be edited. Upload a new document for review.';
    end if;
    new.status := old.status;
    new.rejection_reason := old.rejection_reason;
    new.verified_at := old.verified_at;
    new.verified_by := old.verified_by;
  end if;
  return new;
end;
$$;

create or replace function public.protect_professional_certification_status()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if auth.uid()=old.professional_id and not exists(select 1 from public.profiles where id=auth.uid() and role='admin') then
    if old.status='verified' and (
      new.name is distinct from old.name or
      new.issuer is distinct from old.issuer or
      new.issued_at is distinct from old.issued_at or
      new.expires_at is distinct from old.expires_at
    ) then
      raise exception 'Verified certification cannot be edited. Submit a new certification for review.';
    end if;
    new.status := old.status;
  end if;
  return new;
end;
$$;

create or replace function public.protect_professional_skill_verified()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if auth.uid()=old.professional_id and not exists(select 1 from public.profiles where id=auth.uid() and role='admin') then
    if old.verified and (
      new.experience_level is distinct from old.experience_level or
      new.years_experience is distinct from old.years_experience
    ) then
      raise exception 'Verified skill evidence cannot be edited. Ask MediCrew to re-verify the changed skill.';
    end if;
    new.verified := old.verified;
  end if;
  return new;
end;
$$;

create or replace function public.protect_company_document_verification_fields()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if auth.uid()=old.company_id and not exists(select 1 from public.profiles where id=auth.uid() and role='admin') then
    if old.status='verified' and (
      new.document_type is distinct from old.document_type or
      new.title is distinct from old.title or
      new.reference is distinct from old.reference or
      new.storage_path is distinct from old.storage_path
    ) then
      raise exception 'Verified organization evidence cannot be edited. Upload a new document for review.';
    end if;
    new.status := old.status;
    new.rejection_reason := old.rejection_reason;
  end if;
  return new;
end;
$$;
