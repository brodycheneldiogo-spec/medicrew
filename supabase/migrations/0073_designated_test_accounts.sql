-- Exact, owner-designated test identities. All other users keep the normal
-- confirmation and manual verification flows.
create or replace function public.confirm_designated_test_email()
returns trigger
language plpgsql
security definer
set search_path = auth, public
as $$
begin
  if lower(coalesce(new.email, '')) in (
    'work.medicrew.app@gmail.com',
    'brodycheneldiogo@gmail.com'
  ) then
    new.email_confirmed_at := coalesce(new.email_confirmed_at, now());
    new.confirmation_token := '';
  end if;
  return new;
end;
$$;

revoke all on function public.confirm_designated_test_email() from public, anon, authenticated;

drop trigger if exists auth_confirm_designated_test_email on auth.users;
create trigger auth_confirm_designated_test_email
before insert on auth.users
for each row execute function public.confirm_designated_test_email();

create or replace function public.apply_designated_test_role()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_email text;
  v_role text;
begin
  select lower(email), raw_user_meta_data->>'role'
  into v_email, v_role
  from auth.users where id = new.id;
  if v_email = 'brodycheneldiogo@gmail.com' and v_role in ('professional', 'company') then
    new.role := v_role::public.account_role;
  end if;
  return new;
end;
$$;

revoke all on function public.apply_designated_test_role() from public, anon, authenticated;
drop trigger if exists zz_profiles_designated_test_role on public.profiles;
create trigger zz_profiles_designated_test_role
before update on public.profiles
for each row execute function public.apply_designated_test_role();

create or replace function public.switch_designated_test_role(p_role public.account_role)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_exists boolean := false;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if p_role not in ('professional', 'company') then raise exception 'Invalid test role'; end if;
  select lower(email) into v_email from auth.users where id = v_uid;
  if v_email <> 'brodycheneldiogo@gmail.com' then raise exception 'Test account required'; end if;

  update auth.users
  set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('role', p_role::text)
  where id = v_uid;
  update public.profiles set role = p_role, email = v_email, updated_at = now() where id = v_uid;

  if p_role = 'professional' then
    select exists(select 1 from public.professionals where id = v_uid) into v_exists;
    if v_exists then update public.professionals set verification_status = 'verified', updated_at = now() where id = v_uid; end if;
  else
    select exists(select 1 from public.companies where id = v_uid) into v_exists;
    if v_exists then update public.companies set verification_status = 'verified', updated_at = now() where id = v_uid; end if;
  end if;
  return jsonb_build_object('role', p_role, 'needs_onboarding', not v_exists);
end;
$$;

revoke all on function public.switch_designated_test_role(public.account_role) from public, anon;
grant execute on function public.switch_designated_test_role(public.account_role) to authenticated;

-- The existing confirmed test identity can use either side immediately when
-- the matching domain profile already exists.
update public.professionals pr set verification_status = 'verified', updated_at = now()
from public.profiles p where p.id = pr.id and lower(p.email) = 'brodycheneldiogo@gmail.com';
update public.companies c set verification_status = 'verified', updated_at = now()
from public.profiles p where p.id = c.id and lower(p.email) = 'brodycheneldiogo@gmail.com';
