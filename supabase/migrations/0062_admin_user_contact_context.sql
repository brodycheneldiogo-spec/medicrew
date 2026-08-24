create or replace function public.admin_verification_queue_v2()
returns jsonb
language plpgsql security definer set search_path=public as $$
declare result jsonb;
begin
 if not exists(select 1 from public.profiles where id=auth.uid() and role='admin') then raise exception 'Admin access required'; end if;
 select jsonb_build_object(
  'documents',coalesce((select jsonb_agg(row_to_json(x) order by x.last_name nulls last,x.first_name nulls last,x.created_at desc) from(
   select d.id,d.professional_id,d.document_type,d.title,d.reference,d.expires_at,d.status,d.rejection_reason,d.created_at,d.storage_path,
    pr.first_name,pr.last_name,pr.email,pr.phone,p.professional_type,p.specialty,p.nationality,p.license_number,p.license_country,p.license_authority,p.license_expires_at,p.years_experience
   from public.professional_documents d join public.profiles pr on pr.id=d.professional_id join public.professionals p on p.id=d.professional_id
   where d.status='pending' or(d.expires_at is not null and d.expires_at<current_date and d.status='verified')
  )x),'[]'::jsonb),
  'certifications',coalesce((select jsonb_agg(row_to_json(y) order by y.last_name nulls last,y.first_name nulls last,y.created_at desc) from(
   select c.id,c.professional_id,c.name,c.issuer,c.issued_at,c.expires_at,c.status,c.created_at,pr.first_name,pr.last_name,pr.email,pr.phone,p.professional_type,p.license_country,p.license_authority
   from public.professional_certifications c join public.profiles pr on pr.id=c.professional_id join public.professionals p on p.id=c.professional_id
   where c.status='pending' or(c.expires_at is not null and c.expires_at<current_date and c.status='verified')
  )y),'[]'::jsonb)
 ) into result;return result;
end;$$;
revoke all on function public.admin_verification_queue_v2() from public;grant execute on function public.admin_verification_queue_v2() to authenticated;

create or replace function public.admin_company_verification_queue()
returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb;
begin
 if not exists(select 1 from public.profiles where id=auth.uid() and role='admin') then raise exception 'Admin access required'; end if;
 select coalesce(jsonb_agg(row_to_json(x) order by x.company_name,x.created_at desc),'[]'::jsonb) into result from(
  select d.id,d.company_id,d.document_type,d.title,d.reference,d.storage_path,d.status,d.rejection_reason,d.created_at,
   c.company_name,c.company_type,c.registration_country,c.registration_number,c.address,c.contact_name,pr.email,pr.phone
  from public.company_verification_documents d join public.companies c on c.id=d.company_id join public.profiles pr on pr.id=c.id
  where d.status in('pending','expired')
 )x;return jsonb_build_object('documents',result);
end;$$;
revoke all on function public.admin_company_verification_queue() from public;grant execute on function public.admin_company_verification_queue() to authenticated;

