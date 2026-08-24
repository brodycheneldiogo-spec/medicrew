-- User presentation preferences and explicit contractual mission currency.
alter table public.profiles add column if not exists preferred_language text not null default 'en';
alter table public.profiles add column if not exists preferred_currency text not null default 'EUR';

alter table public.profiles drop constraint if exists profiles_preferred_language_check;
alter table public.profiles add constraint profiles_preferred_language_check check (preferred_language in ('en','fr','es'));
alter table public.profiles drop constraint if exists profiles_preferred_currency_check;
alter table public.profiles add constraint profiles_preferred_currency_check check (preferred_currency in ('EUR','USD'));

alter table public.missions add column if not exists compensation_currency text not null default 'EUR';
alter table public.missions drop constraint if exists missions_compensation_currency_check;
alter table public.missions add constraint missions_compensation_currency_check check (compensation_currency in ('EUR','USD'));

comment on column public.profiles.preferred_currency is 'Display preference only. It never changes contractual mission amounts.';
comment on column public.missions.compensation_currency is 'Original contractual currency for professional compensation. MediCrew V1 supports EUR and USD.';

