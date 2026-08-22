-- Designated MediCrew operations admin.
-- Authentication still happens through Supabase Auth; this only assigns the in-app admin role.
create or replace function public.bootstrap_designated_admin()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if lower(coalesce(new.email,''))='work.medicrew.app@gmail.com' then
    new.role := 'admin';
  end if;
  return new;
end;
$$;

revoke all on function public.bootstrap_designated_admin() from public;

drop trigger if exists profiles_designated_admin on public.profiles;
create trigger profiles_designated_admin
before insert or update of email on public.profiles
for each row execute function public.bootstrap_designated_admin();

-- Promote the designated account immediately if it already exists.
update public.profiles
set role='admin'
where lower(coalesce(email,''))='work.medicrew.app@gmail.com';
