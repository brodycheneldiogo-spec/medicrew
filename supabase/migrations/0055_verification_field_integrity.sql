-- Prevent owners from self-verifying accounts, documents, certifications or skills.
-- Verification state is server/admin managed regardless of client UI or direct API use.

create or replace function public.protect_professional_verification_status()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if auth.uid()=old.id and not exists(select 1 from public.profiles where id=auth.uid() and role='admin') then
    new.verification_status := old.verification_status;
  end if;
  return new;
end;
$$;
drop trigger if exists professionals_protect_verification_status on public.professionals;
create trigger professionals_protect_verification_status
before update on public.professionals
for each row execute function public.protect_professional_verification_status();

create or replace function public.protect_company_verification_status()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if auth.uid()=old.id and not exists(select 1 from public.profiles where id=auth.uid() and role='admin') then
    new.verification_status := old.verification_status;
  end if;
  return new;
end;
$$;
drop trigger if exists companies_protect_verification_status on public.companies;
create trigger companies_protect_verification_status
before update on public.companies
for each row execute function public.protect_company_verification_status();

create or replace function public.protect_professional_document_verification_fields()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if auth.uid()=old.professional_id and not exists(select 1 from public.profiles where id=auth.uid() and role='admin') then
    new.status := old.status;
    new.rejection_reason := old.rejection_reason;
    new.verified_at := old.verified_at;
    new.verified_by := old.verified_by;
  end if;
  return new;
end;
$$;
drop trigger if exists professional_documents_protect_verification on public.professional_documents;
create trigger professional_documents_protect_verification
before update on public.professional_documents
for each row execute function public.protect_professional_document_verification_fields();

create or replace function public.protect_professional_certification_status()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if auth.uid()=old.professional_id and not exists(select 1 from public.profiles where id=auth.uid() and role='admin') then
    new.status := old.status;
  end if;
  return new;
end;
$$;
drop trigger if exists professional_certifications_protect_status on public.professional_certifications;
create trigger professional_certifications_protect_status
before update on public.professional_certifications
for each row execute function public.protect_professional_certification_status();

create or replace function public.protect_professional_skill_verified()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if auth.uid()=old.professional_id and not exists(select 1 from public.profiles where id=auth.uid() and role='admin') then
    new.verified := old.verified;
  end if;
  return new;
end;
$$;
drop trigger if exists professional_skills_protect_verified on public.professional_skills;
create trigger professional_skills_protect_verified
before update on public.professional_skills
for each row execute function public.protect_professional_skill_verified();

-- Company verification document tables were introduced later; guard their admin-owned status fields too.
create or replace function public.protect_company_document_verification_fields()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if auth.uid()=old.company_id and not exists(select 1 from public.profiles where id=auth.uid() and role='admin') then
    new.status := old.status;
    new.rejection_reason := old.rejection_reason;
  end if;
  return new;
end;
$$;
drop trigger if exists company_documents_protect_verification on public.company_verification_documents;
create trigger company_documents_protect_verification
before update on public.company_verification_documents
for each row execute function public.protect_company_document_verification_fields();
