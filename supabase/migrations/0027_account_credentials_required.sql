-- MediCrew: phone + email/password are mandatory account credentials.
-- New auth users may receive a temporary profile before phone/email completion;
-- a professional record cannot be created until both credentials are complete.
-- No patient data is stored.

create or replace function public.require_complete_professional_credentials()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_phone text;
  v_phone_confirmed_at timestamptz;
begin
  select p.email, p.phone into v_email, v_phone
  from public.profiles p where p.id = new.id;

  select u.phone_confirmed_at into v_phone_confirmed_at
  from auth.users u where u.id = new.id;

  if nullif(trim(coalesce(v_phone, '')), '') is null then
    raise exception 'A verified phone number is required before creating a professional account';
  end if;
  if v_phone_confirmed_at is null then
    raise exception 'The phone number must be verified before creating a professional account';
  end if;
  if nullif(trim(coalesce(v_email, '')), '') is null then
    raise exception 'A valid email address is required before creating a professional account';
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
  v_phone_confirmed_at timestamptz;
begin
  -- The initial handle_new_user trigger intentionally creates a temporary
  -- profile after phone signup. Only later credential updates are blocked.
  if tg_op = 'UPDATE' and new.role = 'professional' then
    select u.phone_confirmed_at into v_phone_confirmed_at
    from auth.users u where u.id = new.id;

    if nullif(trim(coalesce(new.phone, '')), '') is null then
      raise exception 'Professional accounts require a phone number';
    end if;
    if v_phone_confirmed_at is null then
      raise exception 'Professional accounts require a verified phone number';
    end if;
    if nullif(trim(coalesce(new.email, '')), '') is null then
      raise exception 'Professional accounts require an email address';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists professionals_require_credentials on public.professionals;
create trigger professionals_require_credentials
before insert or update on public.professionals
for each row execute function public.require_complete_professional_credentials();

drop trigger if exists profiles_require_professional_credentials on public.profiles;
create trigger profiles_require_professional_credentials
before update of role, email, phone on public.profiles
for each row execute function public.prevent_incomplete_professional_profile();

revoke all on function public.require_complete_professional_credentials() from public;
revoke all on function public.prevent_incomplete_professional_profile() from public;
