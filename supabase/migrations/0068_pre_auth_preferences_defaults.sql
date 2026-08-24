-- MediCrew defaults to English + USD before and after account creation.
alter table public.profiles alter column preferred_language set default 'en';
alter table public.profiles alter column preferred_currency set default 'USD';

-- Capture language/currency selected before signup directly when the auth profile is created.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  requested_role text := new.raw_user_meta_data->>'role';
  safe_role public.account_role;
  requested_language text := new.raw_user_meta_data->>'preferred_language';
  requested_currency text := new.raw_user_meta_data->>'preferred_currency';
  safe_language text;
  safe_currency text;
begin
  if requested_role = 'company' then safe_role := 'company'; else safe_role := 'professional'; end if;
  if requested_language in ('en','fr','es') then safe_language := requested_language; else safe_language := 'en'; end if;
  if requested_currency in ('EUR','USD') then safe_currency := requested_currency; else safe_currency := 'USD'; end if;

  insert into public.profiles (id, role, email, first_name, last_name, preferred_language, preferred_currency)
  values (new.id, safe_role, new.email, new.raw_user_meta_data->>'first_name', new.raw_user_meta_data->>'last_name', safe_language, safe_currency);
  return new;
end;
$$;

comment on column public.profiles.preferred_language is 'UI language. Defaults to English; users may select English, French, or Spanish before signup or later in Settings.';
comment on column public.profiles.preferred_currency is 'Display currency only. Defaults to USD; users may select USD or EUR before signup or later in Settings.';

