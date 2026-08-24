-- Professional verification records.
-- This version stores verification metadata only. Actual file/blob storage is intentionally deferred
-- until the final external-services phase.

create table if not exists public.professional_documents (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professionals(id) on delete cascade,
  document_type text not null check (document_type in ('identity','rpps','cv','rcp_insurance','diploma','certificate','other')),
  title text not null,
  reference text,
  expires_at date,
  status public.document_status not null default 'pending',
  rejection_reason text,
  verified_at timestamptz,
  verified_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists professional_documents_professional_idx
  on public.professional_documents(professional_id, created_at desc);
create index if not exists professional_documents_expiry_idx
  on public.professional_documents(expires_at);

alter table public.professional_documents enable row level security;

-- Professionals can manage their own submitted metadata, but cannot self-verify it.
drop policy if exists professional_documents_owner_select on public.professional_documents;
create policy professional_documents_owner_select on public.professional_documents
  for select to authenticated
  using (professional_id = auth.uid());

drop policy if exists professional_documents_owner_insert on public.professional_documents;
create policy professional_documents_owner_insert on public.professional_documents
  for insert to authenticated
  with check (professional_id = auth.uid());

drop policy if exists professional_documents_owner_update on public.professional_documents;
create policy professional_documents_owner_update on public.professional_documents
  for update to authenticated
  using (professional_id = auth.uid())
  with check (professional_id = auth.uid());

-- Return the professional's complete verification picture without exposing anything to other users.
create or replace function public.get_my_verification_summary()
returns jsonb
language sql security definer set search_path = public
as $$
  select jsonb_build_object(
    'documents', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',d.id,
        'type',d.document_type,
        'title',d.title,
        'reference',d.reference,
        'expires_at',d.expires_at,
        'status',case when d.expires_at is not null and d.expires_at < current_date and d.status='verified' then 'expired' else d.status end,
        'rejection_reason',d.rejection_reason,
        'verified_at',d.verified_at
      ) order by d.created_at desc)
      from public.professional_documents d
      where d.professional_id=auth.uid()
    ), '[]'::jsonb),
    'certifications', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',c.id,'type','Certification','title',c.name,'issuer',c.issuer,
        'issued_at',c.issued_at,'expires_at',c.expires_at,
        'status',case when c.expires_at is not null and c.expires_at < current_date and c.status='verified' then 'expired' else c.status end
      ) order by c.expires_at nulls last,c.name)
      from public.professional_certifications c
      where c.professional_id=auth.uid()
    ), '[]'::jsonb)
  )
  where exists(select 1 from public.professionals where id=auth.uid());
$$;
grant execute on function public.get_my_verification_summary() to authenticated;

-- Admin queue: sensitive verification metadata is returned only after an explicit admin check.
create or replace function public.admin_verification_queue()
returns jsonb
language plpgsql security definer set search_path=public
as $$
declare result jsonb;
begin
  if not exists(select 1 from public.profiles where id=auth.uid() and role='admin') then
    raise exception 'Admin access required';
  end if;
  select jsonb_build_object(
    'documents', coalesce((select jsonb_agg(row_to_json(x) order by x.created_at desc) from (
      select d.id,d.professional_id,d.document_type,d.title,d.reference,d.expires_at,d.status,d.rejection_reason,d.created_at,
             p.first_name,p.last_name,pr.professional_type,pr.specialty,pr.rpps_number
      from public.professional_documents d
      join public.profiles p on p.id=d.professional_id
      join public.professionals pr on pr.id=d.professional_id
      where d.status='pending' or (d.expires_at is not null and d.expires_at < current_date and d.status='verified')
    ) x), '[]'::jsonb),
    'certifications', coalesce((select jsonb_agg(row_to_json(y) order by y.created_at desc) from (
      select c.id,c.professional_id,c.name,c.issuer,c.issued_at,c.expires_at,c.status,c.created_at,
             p.first_name,p.last_name
      from public.professional_certifications c
      join public.profiles p on p.id=c.professional_id
      where c.status='pending' or (c.expires_at is not null and c.expires_at < current_date and c.status='verified')
    ) y), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;
grant execute on function public.admin_verification_queue() to authenticated;

create or replace function public.admin_verify_document(
  p_document_id uuid,
  p_status public.document_status,
  p_reason text default null
)
returns void
language plpgsql security definer set search_path=public
as $$
declare v_professional uuid;
begin
  if not exists(select 1 from public.profiles where id=auth.uid() and role='admin') then
    raise exception 'Admin access required';
  end if;
  if p_status not in ('verified','rejected','pending','expired') then
    raise exception 'Invalid document status';
  end if;
  select professional_id into v_professional from public.professional_documents where id=p_document_id;
  if v_professional is null then raise exception 'Document not found'; end if;

  update public.professional_documents
  set status=p_status,
      rejection_reason=case when p_status='rejected' then nullif(trim(coalesce(p_reason,'')),'') else null end,
      verified_at=case when p_status='verified' then now() else null end,
      verified_by=case when p_status='verified' then auth.uid() else null end,
      updated_at=now()
  where id=p_document_id;

  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(auth.uid(),'professional_document_verification_changed','professional_document',p_document_id,
         jsonb_build_object('professional_id',v_professional,'status',p_status,'reason',coalesce(p_reason,'')));
  insert into public.notifications(profile_id,title,body,type,data)
  values(v_professional,'Document verification updated','A MediCrew administrator updated your document verification status.','document_verification',
         jsonb_build_object('document_id',p_document_id,'status',p_status));
end;
$$;
grant execute on function public.admin_verify_document(uuid,public.document_status,text) to authenticated;

create or replace function public.admin_verify_skill(
  p_professional_id uuid,
  p_skill_id uuid,
  p_verified boolean
)
returns void
language plpgsql security definer set search_path=public
as $$
begin
  if not exists(select 1 from public.profiles where id=auth.uid() and role='admin') then
    raise exception 'Admin access required';
  end if;
  update public.professional_skills
  set verified=p_verified
  where professional_id=p_professional_id and skill_id=p_skill_id;
  if not found then raise exception 'Professional skill not found'; end if;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(auth.uid(),'professional_skill_verification_changed','professional_skill',p_skill_id,
         jsonb_build_object('professional_id',p_professional_id,'verified',p_verified));
end;
$$;
grant execute on function public.admin_verify_skill(uuid,uuid,boolean) to authenticated;

