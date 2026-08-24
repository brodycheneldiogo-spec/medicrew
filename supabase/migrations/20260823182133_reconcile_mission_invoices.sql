-- Recreate the MediCrew service-fee invoice ledger that was skipped when a
-- different remote migration had already claimed version 0046.
create table if not exists public.mission_invoices (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null unique references public.missions(id) on delete restrict,
  company_id uuid not null references public.companies(id) on delete restrict,
  stripe_customer_id text,
  stripe_invoice_id text unique,
  status text not null default 'pending'
    check (status in ('pending','draft','open','paid','void','uncollectible','failed')),
  amount_cents bigint not null check (amount_cents >= 0),
  currency text not null default 'eur',
  hosted_invoice_url text,
  invoice_pdf_url text,
  due_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mission_invoices_company_idx
  on public.mission_invoices(company_id, created_at desc);
create index if not exists mission_invoices_status_idx
  on public.mission_invoices(status, created_at desc);

alter table public.mission_invoices enable row level security;

revoke all on table public.mission_invoices from anon, authenticated;
grant select on table public.mission_invoices to authenticated;

drop policy if exists mission_invoices_company_read on public.mission_invoices;
drop policy if exists mission_invoices_admin_read on public.mission_invoices;

create policy mission_invoices_company_read
on public.mission_invoices
for select
to authenticated
using ((select auth.uid()) = company_id);

create policy mission_invoices_admin_read
on public.mission_invoices
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = (select auth.uid())
      and profiles.role = 'admin'
  )
);

comment on table public.mission_invoices is
  'MediCrew service-fee invoices. Professional compensation is paid directly by the company outside MediCrew.';
