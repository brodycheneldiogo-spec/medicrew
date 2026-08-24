-- MediCrew authentication v2: email/password or Google only.
-- Phone numbers are optional profile data and are not required for account creation or marketplace access.

create or replace function public.require_complete_professional_credentials()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_email_confirmed_at timestamptz;
begin
  select p.email into v_email from public.profiles p where p.id = new.id;
  select u.email_confirmed_at into v_email_confirmed_at from auth.users u where u.id = new.id;

  if nullif(trim(coalesce(v_email, '')), '') is null then
    raise exception 'A valid email address is required before creating a professional account';
  end if;
  if v_email_confirmed_at is null then
    raise exception 'The email address must be verified before creating a professional account';
  end if;
  return new;
end;
$$;

create or replace function public.prevent_incomplete_professional_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email_confirmed_at timestamptz;
begin
  if tg_op = 'UPDATE' and new.role = 'professional' then
    select u.email_confirmed_at into v_email_confirmed_at from auth.users u where u.id = new.id;
    if nullif(trim(coalesce(new.email, '')), '') is null then
      raise exception 'Professional accounts require an email address';
    end if;
    if v_email_confirmed_at is null then
      raise exception 'Professional accounts require a verified email address';
    end if;
  end if;
  return new;
end;
$$;

-- Phone is no longer part of the profile credential trigger.
drop trigger if exists profiles_require_professional_credentials on public.profiles;
create trigger profiles_require_professional_credentials
before update of role, email on public.profiles
for each row execute function public.prevent_incomplete_professional_profile();

-- Preserve the existing identity protection while allowing the authenticated user to set
-- professional/company exactly during initial OAuth onboarding. Admin can never be self-selected.
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
  v_requested_role text;
  v_has_domain_record boolean := false;
begin
  select exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin') into v_actor_is_admin;

  if auth.uid() = old.id and not v_actor_is_admin then
    select u.email,u.phone,u.email_confirmed_at,u.phone_confirmed_at,u.raw_user_meta_data->>'role'
      into v_email,v_phone,v_email_confirmed,v_phone_confirmed,v_requested_role
    from auth.users u where u.id=old.id;

    select exists(select 1 from public.professionals where id=old.id)
        or exists(select 1 from public.companies where id=old.id)
      into v_has_domain_record;

    if new.role is distinct from old.role then
      if v_has_domain_record
         or new.role not in ('professional','company')
         or v_requested_role is distinct from new.role::text then
        new.role := old.role;
      end if;
    end if;

    new.email := case when v_email_confirmed is not null then v_email else old.email end;
    new.phone := case when v_phone_confirmed is not null then v_phone else old.phone end;
  end if;
  return new;
end;
$$;

create unique index if not exists legal_acceptances_version_unique
on public.legal_acceptances(profile_id,terms_version,privacy_version,data_policy_version);

-- Persist the legal acceptance captured during email signup once the email is confirmed.
create or replace function public.capture_email_signup_legal_acceptance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_terms text;
  v_privacy text;
  v_data text;
begin
  if new.email_confirmed_at is not null and old.email_confirmed_at is null
     and coalesce((new.raw_user_meta_data->>'legal_accepted')::boolean,false) then
    v_terms := coalesce(new.raw_user_meta_data->>'terms_version','2.1');
    v_privacy := coalesce(new.raw_user_meta_data->>'privacy_version','1.2');
    v_data := coalesce(new.raw_user_meta_data->>'data_policy_version','1.1');
    insert into public.legal_acceptances(profile_id,terms_version,privacy_version,data_policy_version)
    values(new.id,v_terms,v_privacy,v_data)
    on conflict(profile_id,terms_version,privacy_version,data_policy_version) do nothing;
    update public.profiles set email=new.email,updated_at=now() where id=new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists auth_capture_email_signup_legal_acceptance on auth.users;
create trigger auth_capture_email_signup_legal_acceptance
after update of email_confirmed_at on auth.users
for each row execute function public.capture_email_signup_legal_acceptance();

comment on column public.profiles.phone is 'Optional contact field. MediCrew authentication uses email/password or supported OAuth providers, not SMS OTP.';

