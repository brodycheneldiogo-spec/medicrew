-- Nearby discovery remains strict by base. An explicit text search can explore eligible work more broadly.
create or replace function public.professional_discover_missions(p_query text default null,p_kind text default null,p_limit integer default 60)
returns setof public.missions language sql stable security definer set search_path=public as $$
 select m.* from public.missions m join public.professionals pr on pr.id=auth.uid()
 where public.professional_has_current_launch_evidence(pr.id)
   and m.status in('published','matching')
   and m.professional_type=pr.professional_type
   and exists(select 1 from public.professional_available_days d where d.professional_id=auth.uid() and d.available_date=(m.departure_at at time zone 'UTC')::date)
   and (p_kind is null or m.mission_kind=p_kind)
   and (
     nullif(trim(p_query),'') is not null
     or (m.mission_kind='transport' and nullif(trim(pr.base_airport_code),'') is not null and upper(trim(coalesce(m.departure_airport_code,'')))=upper(trim(pr.base_airport_code)))
     or (m.mission_kind='event' and (lower(trim(coalesce(m.event_city,'')))=lower(trim(coalesce(pr.base_city,''))) or lower(trim(coalesce(m.event_country,'')))=lower(trim(coalesce(pr.country_of_operation,'')))))
   )
   and (nullif(trim(p_query),'') is null or lower(coalesce(m.title,'')||' '||coalesce(m.departure_location,'')||' '||coalesce(m.destination_location,'')||' '||coalesce(m.departure_airport_code,'')||' '||coalesce(m.arrival_airport_code,'')||' '||coalesce(m.event_name,'')||' '||coalesce(m.event_city,'')||' '||coalesce(m.event_country,'')) like '%'||lower(trim(p_query))||'%')
 order by m.departure_at
 limit least(greatest(coalesce(p_limit,60),1),100);
$$;
revoke all on function public.professional_discover_missions(text,text,integer) from public;
grant execute on function public.professional_discover_missions(text,text,integer) to authenticated;

-- Recreate profile search with an explicit ordering expression rather than relying on an OUT-column alias.
create or replace function public.network_search_profiles(p_query text default null,p_role public.account_role default null,p_limit integer default 40)
returns table(profile_id uuid,role public.account_role,display_name text,headline text,city text,country text,avatar_url text,subtitle text)
language sql stable security definer set search_path=public as $$
 select p.id,p.role,
  case when p.role='company' then c.company_name else trim(coalesce(p.first_name,'')||' '||coalesce(p.last_name,'')) end,
  p.headline,p.city,p.country,p.avatar_url,
  case when p.role='company' then case when c.company_type='event' then 'Event medical staffing' else 'Medical transport' end else concat(case when pr.professional_type='nurse' then 'Nurse' else 'Doctor' end,case when pr.specialty is not null then ' · '||pr.specialty else '' end) end
 from public.profiles p
 left join public.professionals pr on pr.id=p.id
 left join public.companies c on c.id=p.id
 where p.role in('professional','company')
   and (p_role is null or p.role=p_role)
   and ((p.role='professional' and public.professional_has_current_launch_evidence(p.id)) or (p.role='company' and c.verification_status='verified'))
   and (nullif(trim(p_query),'') is null or lower(coalesce(p.first_name,'')||' '||coalesce(p.last_name,'')||' '||coalesce(c.company_name,'')||' '||coalesce(p.headline,'')||' '||coalesce(p.city,'')||' '||coalesce(p.country,'')||' '||coalesce(pr.specialty,'')) like '%'||lower(trim(p_query))||'%')
 order by lower(case when p.role='company' then coalesce(c.company_name,'') else trim(coalesce(p.last_name,'')||' '||coalesce(p.first_name,'')) end)
 limit least(greatest(coalesce(p_limit,40),1),100);
$$;
revoke all on function public.network_search_profiles(text,public.account_role,integer) from public;
grant execute on function public.network_search_profiles(text,public.account_role,integer) to authenticated;

create or replace function public.start_direct_conversation(p_target_profile uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid;v_me public.account_role;v_target public.account_role;
begin
 if auth.uid() is null or p_target_profile=auth.uid() then raise exception 'Invalid conversation target'; end if;
 select role into v_me from public.profiles where id=auth.uid();
 select role into v_target from public.profiles where id=p_target_profile;
 if v_me not in('professional','company') or v_target not in('professional','company') then raise exception 'Profile is not available for direct messaging'; end if;
 if v_me='company' and v_target='company' then raise exception 'Organization-to-organization direct messaging is not supported'; end if;
 if v_me='professional' and not public.professional_has_current_launch_evidence(auth.uid()) then raise exception 'Verified professional account required'; end if;
 if v_me='company' and not exists(select 1 from public.companies where id=auth.uid() and verification_status='verified') then raise exception 'Verified organization required'; end if;
 if v_target='professional' and not public.professional_has_current_launch_evidence(p_target_profile) then raise exception 'Target professional is not currently verified'; end if;
 if v_target='company' and not exists(select 1 from public.companies where id=p_target_profile and verification_status='verified') then raise exception 'Target organization is not currently verified'; end if;
 select c.id into v_id from public.direct_conversations c
 where exists(select 1 from public.direct_conversation_members a where a.conversation_id=c.id and a.profile_id=auth.uid())
 and exists(select 1 from public.direct_conversation_members b where b.conversation_id=c.id and b.profile_id=p_target_profile)
 and 2=(select count(*) from public.direct_conversation_members z where z.conversation_id=c.id) limit 1;
 if v_id is null then
  insert into public.direct_conversations default values returning id into v_id;
  insert into public.direct_conversation_members(conversation_id,profile_id) values(v_id,auth.uid()),(v_id,p_target_profile);
 end if;
 return v_id;
end;$$;
revoke all on function public.start_direct_conversation(uuid) from public;
grant execute on function public.start_direct_conversation(uuid) to authenticated;
