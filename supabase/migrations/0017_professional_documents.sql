-- Professional verification records. No patient data is stored here.
-- File binaries should not be put in ordinary text columns; this table stores only
-- document metadata/reference and verification state.
create type public.professional_document_type as enum (
  'identity',
  'rpps',
  'cv',
  'rcp_insurance',
  'diploma',
  'certificate',
  'other'
);

create table public.professional_documents (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professionals(id) on delete cascade,
  document_type public.professional_document_type not null,
  title text not null,
  reference text,
  issued_at date,
  expires_at date,
  status public.document_status not null default 'pending',
  rejection_reason text,
  verified_at timestamptz,
  verified_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (professional_id, document_type, title)
);

create index professional_documents_owner_idx on public.professional_documents(professional_id);
create index professional_documents_status_expiry_idx on public.professional_documents(status, expires_at);

alter table public.professional_documents enable row level security;

create policy "professional documents self read"
on public.professional_documents for select
using (professional_id = auth.uid());

create policy "professional documents self insert"
on public.professional_documents for insert
with check (professional_id = auth.uid());

create policy "professional documents self update"
on public.professional_documents for update
using (professional_id = auth.uid())
with check (professional_id = auth.uid());

create policy "professional documents self delete"
on public.professional_documents for delete
using (professional_id = auth.uid());

create trigger professional_documents_updated_at
before update on public.professional_documents
for each row execute procedure public.set_updated_at();

-- Keep document state honest when an expiry date passes.
create or replace function public.refresh_expired_professional_documents()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  changed integer;
begin
  update public.professional_documents
  set status = 'expired', updated_at = now()
  where expires_at is not null
    and expires_at < current_date
    and status in ('pending','verified');
  get diagnostics changed = row_count;

  update public.professional_certifications
  set status = 'expired'
  where expires_at is not null
    and expires_at < current_date
    and status in ('pending','verified');

  return changed;
end;
$$;

-- One RPC gives the app a single consistent verification summary.
create or replace function public.get_my_verification_summary()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_docs jsonb;
  v_certs jsonb;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;

  perform public.refresh_expired_professional_documents();

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', d.id,
    'type', d.document_type,
    'title', d.title,
    'reference', d.reference,
    'issued_at', d.issued_at,
    'expires_at', d.expires_at,
    'status', d.status,
    'rejection_reason', d.rejection_reason,
    'verified_at', d.verified_at
    ) order by d.created_at desc), '[]'::jsonb)
  into v_docs
  from public.professional_documents d
  where d.professional_id = v_uid;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id,
    'title', c.name,
    'issuer', c.issuer,
    'issued_at', c.issued_at,
    'expires_at', c.expires_at,
    'status', c.status
    ) order by c.created_at desc), '[]'::jsonb)
  into v_certs
  from public.professional_certifications c
  where c.professional_id = v_uid;

  return jsonb_build_object('documents', v_docs, 'certifications', v_certs);
end;
$$;

grant execute on function public.get_my_verification_summary() to authenticated;
grant execute on function public.refresh_expired_professional_documents() to authenticated;
