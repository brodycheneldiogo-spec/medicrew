-- MediCrew consistency fixes.
-- Fix the legacy mission requirement RPC to match the current schema (requirement_kind.kind),
-- and add the missing certification verification operation used by the admin UI.

create or replace function public.set_mission_requirement(p_mission_id uuid,p_skill_slug text,p_required boolean default true,p_minimum_level public.experience_level default 'basic',p_minimum_years numeric default 0)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_skill uuid;v_id uuid;v_kind public.requirement_kind;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not exists(select 1 from public.missions where id=p_mission_id and company_id=auth.uid()) then raise exception 'Mission not found or unavailable'; end if;
  select id into v_skill from public.skills where slug=lower(trim(p_skill_slug));
  if v_skill is null then raise exception 'Unknown skill: %',p_skill_slug; end if;
  v_kind:=case when coalesce(p_required,true) then 'mandatory'::public.requirement_kind else 'preferred'::public.requirement_kind end;
  insert into public.mission_requirements(mission_id,skill_id,kind,minimum_level,minimum_years)
  values(p_mission_id,v_skill,v_kind,p_minimum_level,greatest(coalesce(p_minimum_years,0),0))
  on conflict (mission_id,skill_id) where skill_id is not null do update set kind=excluded.kind,minimum_level=excluded.minimum_level,minimum_years=excluded.minimum_years
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.set_mission_requirement(uuid,text,boolean,public.experience_level,numeric) from public;
grant execute on function public.set_mission_requirement(uuid,text,boolean,public.experience_level,numeric) to authenticated;

create or replace function public.admin_verify_certification(p_certification_id uuid,p_status public.document_status)
returns void language plpgsql security definer set search_path=public as $$
declare v_professional uuid;
begin
  if not exists(select 1 from public.profiles where id=auth.uid() and role='admin') then raise exception 'Admin access required'; end if;
  if p_status not in ('verified','rejected','pending','expired') then raise exception 'Invalid certification status'; end if;
  select professional_id into v_professional from public.professional_certifications where id=p_certification_id;
  if v_professional is null then raise exception 'Certification not found'; end if;
  update public.professional_certifications set status=p_status where id=p_certification_id;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata) values(auth.uid(),'professional_certification_verification_changed','professional_certification',p_certification_id,jsonb_build_object('professional_id',v_professional,'status',p_status));
  insert into public.notifications(profile_id,title,body,type,data) values(v_professional,'Certification verification updated','A MediCrew administrator updated your certification verification status.','certification_verification',jsonb_build_object('certification_id',p_certification_id,'status',p_status));
end;
$$;
revoke all on function public.admin_verify_certification(uuid,public.document_status) from public;
grant execute on function public.admin_verify_certification(uuid,public.document_status) to authenticated;