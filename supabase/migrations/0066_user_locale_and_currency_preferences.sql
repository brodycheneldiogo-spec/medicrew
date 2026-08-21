alter table public.profiles
  add column if not exists preferred_language text not null default 'en',
  add column if not exists preferred_currency text not null default 'EUR';

alter table public.profiles drop constraint if exists profiles_preferred_language_check;
alter table public.profiles add constraint profiles_preferred_language_check check (preferred_language in ('en','fr','es'));
alter table public.profiles drop constraint if exists profiles_preferred_currency_check;
alter table public.profiles add constraint profiles_preferred_currency_check check (preferred_currency in ('EUR','USD','GBP','CHF'));

comment on column public.profiles.preferred_language is 'MediCrew interface and communication language: en, fr or es.';
comment on column public.profiles.preferred_currency is 'Preferred display currency. Contractual mission currency remains unchanged.';