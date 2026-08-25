-- Public phone is opt-in: users decide whether to save a number in profiles.phone.
-- The network RPC only exposes it to authenticated, verified MediCrew members.
create or replace function public.network_profile(p_profile_id uuid)
returns jsonb language sql stable security definer set search_path=public as $$
 select case p.role
 when 'professional' then jsonb_build_object('id',p.id,'role',p.role,'first_name',p.first_name,'last_name',p.last_name,'email',p.email,'phone',p.phone,'avatar_url',p.avatar_url,'headline',p.headline,'bio',p.bio,'city',p.city,'country',p.country,'professional_type',pr.professional_type,'specialty',pr.specialty,'nationality',pr.nationality,'years_experience',pr.years_experience,'base_airport_code',pr.base_airport_code,'base_city',pr.base_city,'verification_status',pr.verification_status,'license_country',pr.license_country,'license_authority',pr.license_authority)
 when 'company' then jsonb_build_object('id',p.id,'role',p.role,'company_name',c.company_name,'email',p.email,'phone',p.phone,'avatar_url',p.avatar_url,'headline',p.headline,'bio',p.bio,'city',p.city,'country',p.country,'company_type',c.company_type,'website',c.website,'verification_status',c.verification_status)
 else null end
 from public.profiles p left join public.professionals pr on pr.id=p.id left join public.companies c on c.id=p.id
 where public.caller_has_verified_network_access() and p.id=p_profile_id and not p.is_banned and not public.users_are_blocked((select auth.uid()),p.id)
 and ((p.role='professional' and pr.verification_status='verified') or (p.role='company' and c.verification_status='verified') or p.id=(select auth.uid()));
$$;
revoke all on function public.network_profile(uuid) from public,anon;
grant execute on function public.network_profile(uuid) to authenticated;

create or replace function public.admin_verify_professional(p_professional_id uuid, p_status public.verification_status)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not exists (select 1 from public.profiles where id=(select auth.uid()) and role='admin') then raise exception 'Admin access required'; end if;
  if p_status not in ('verified','rejected') then raise exception 'Invalid verification status'; end if;
  update public.professionals set verification_status=p_status, updated_at=now() where id=p_professional_id;
  update public.professional_documents set status=p_status,rejection_reason=case when p_status='rejected' then 'Dossier refusé par MediCrew.' else null end,updated_at=now() where professional_id=p_professional_id and status in ('pending','expired');
  update public.professional_certifications set status=p_status where professional_id=p_professional_id and status in ('pending','expired');
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata) values((select auth.uid()),'professional_verification_changed','professional',p_professional_id,jsonb_build_object('status',p_status,'whole_file',true));
  insert into public.notifications(profile_id,title,body,type,data) values(p_professional_id,'Professional verification updated','Your MediCrew verification status was updated.','professional_verification',jsonb_build_object('status',p_status));
end; $$;
revoke all on function public.admin_verify_professional(uuid,public.verification_status) from public,anon;
grant execute on function public.admin_verify_professional(uuid,public.verification_status) to authenticated;

create or replace function public.admin_verify_company(p_company_id uuid, p_status public.verification_status)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not exists (select 1 from public.profiles where id=(select auth.uid()) and role='admin') then raise exception 'Admin access required'; end if;
  if p_status not in ('verified','rejected') then raise exception 'Invalid verification status'; end if;
  update public.companies set verification_status=p_status, updated_at=now() where id=p_company_id;
  update public.company_verification_documents set status=p_status,rejection_reason=case when p_status='rejected' then 'Dossier refusé par MediCrew.' else null end,updated_at=now() where company_id=p_company_id and status in ('pending','expired');
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata) values((select auth.uid()),'company_verification_changed','company',p_company_id,jsonb_build_object('status',p_status,'whole_file',true));
  insert into public.notifications(profile_id,title,body,type,data) values(p_company_id,'Company verification updated','Your MediCrew company verification status was updated.','company_verification',jsonb_build_object('status',p_status));
end; $$;
revoke all on function public.admin_verify_company(uuid,public.verification_status) from public,anon;
grant execute on function public.admin_verify_company(uuid,public.verification_status) to authenticated;
