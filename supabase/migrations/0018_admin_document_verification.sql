-- Admin-only verification operations. The admin role is checked inside SECURITY DEFINER functions.
create or replace function public.admin_list_pending_documents()
returns table (
  id uuid,
  professional_id uuid,
  document_type public.professional_document_type,
  title text,
  reference text,
  expires_at date,
  status public.document_status,
  created_at timestamptz,
  first_name text,
  last_name text,
  professional_type public.professional_type
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles where id=auth.uid() and role='admin') then
    raise exception 'Admin access required';
  end if;
  return query
  select d.id,d.professional_id,d.document_type,d.title,d.reference,d.expires_at,d.status,d.created_at,
         p.first_name,p.last_name,pr.professional_type
  from public.professional_documents d
  join public.profiles p on p.id=d.professional_id
  join public.professionals pr on pr.id=d.professional_id
  where d.status='pending'
  order by d.created_at asc;
end;
$$;

create or replace function public.admin_set_document_status(
  p_document_id uuid,
  p_status public.document_status,
  p_rejection_reason text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_professional uuid;
begin
  if not exists (select 1 from public.profiles where id=auth.uid() and role='admin') then
    raise exception 'Admin access required';
  end if;

  select professional_id into v_professional from public.professional_documents where id=p_document_id;
  if v_professional is null then raise exception 'Document not found'; end if;

  update public.professional_documents
  set status=p_status,
      rejection_reason=case when p_status='rejected' then nullif(trim(p_rejection_reason),'') else null end,
      verified_at=case when p_status='verified' then now() else null end,
      verified_by=case when p_status='verified' then auth.uid() else null end,
      updated_at=now()
  where id=p_document_id;

  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(auth.uid(),'document_status_changed','professional_document',p_document_id,jsonb_build_object('status',p_status,'professional_id',v_professional));

  return true;
end;
$$;

grant execute on function public.admin_list_pending_documents() to authenticated;
grant execute on function public.admin_set_document_status(uuid,public.document_status,text) to authenticated;
