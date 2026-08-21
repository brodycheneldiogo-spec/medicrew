-- Real professional network model: public professional/company profiles, day-based availability,
-- direct messaging and location-aware mission discovery. No patient-identifying data belongs here.

alter table public.profiles
  add column if not exists headline text,
  add column if not exists bio text,
  add column if not exists city text,
  add column if not exists country text;

alter table public.professionals
  add column if not exists base_airport_code text,
  add column if not exists base_city text;

alter table public.companies
  add column if not exists company_type text,
  add column if not exists website text;

update public.companies
set company_type = case when coalesce(company_scope,organization_type,'') ilike '%event%' then 'event' else 'transport' end
where company_type is null;

alter table public.companies alter column company_type set default 'transport';
alter table public.companies drop constraint if exists companies_company_type_check;
alter table public.companies add constraint companies_company_type_check check (company_type in ('transport','event'));

alter table public.missions
  add column if not exists departure_airport_code text,
  add column if not exists arrival_airport_code text,
  add column if not exists event_city text,
  add column if not exists event_end_at timestamptz,
  add column if not exists staffing_notes text;

create table if not exists public.professional_available_days(
  professional_id uuid not null references public.professionals(id) on delete cascade,
  available_date date not null,
  created_at timestamptz not null default now(),
  primary key(professional_id,available_date)
);
alter table public.professional_available_days enable row level security;
drop policy if exists professional_available_days_owner on public.professional_available_days;
create policy professional_available_days_owner on public.professional_available_days
for all to authenticated using(professional_id=auth.uid()) with check(professional_id=auth.uid());

create table if not exists public.direct_conversations(
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);
create table if not exists public.direct_conversation_members(
  conversation_id uuid not null references public.direct_conversations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key(conversation_id,profile_id)
);
create table if not exists public.direct_messages(
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.direct_conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete restrict,
  body text not null check(length(trim(body)) between 1 and 4000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists direct_messages_conversation_idx on public.direct_messages(conversation_id,created_at);

alter table public.direct_conversations enable row level security;
alter table public.direct_conversation_members enable row level security;
alter table public.direct_messages enable row level security;

create or replace function public.is_direct_conversation_member(p_conversation_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.direct_conversation_members where conversation_id=p_conversation_id and profile_id=auth.uid())
$$;
revoke all on function public.is_direct_conversation_member(uuid) from public;
grant execute on function public.is_direct_conversation_member(uuid) to authenticated;

drop policy if exists direct_conversations_member_read on public.direct_conversations;
create policy direct_conversations_member_read on public.direct_conversations for select to authenticated using(public.is_direct_conversation_member(id));
drop policy if exists direct_members_member_read on public.direct_conversation_members;
create policy direct_members_member_read on public.direct_conversation_members for select to authenticated using(public.is_direct_conversation_member(conversation_id));
drop policy if exists direct_messages_member_read on public.direct_messages;
create policy direct_messages_member_read on public.direct_messages for select to authenticated using(public.is_direct_conversation_member(conversation_id));

create or replace function public.start_direct_conversation(p_target_profile uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
 if auth.uid() is null or p_target_profile=auth.uid() then raise exception 'Invalid conversation target'; end if;
 if not exists(select 1 from public.profiles where id=p_target_profile) then raise exception 'Profile not found'; end if;
 select c.id into v_id from public.direct_conversations c
 where exists(select 1 from public.direct_conversation_members a where a.conversation_id=c.id and a.profile_id=auth.uid())
   and exists(select 1 from public.direct_conversation_members b where b.conversation_id=c.id and b.profile_id=p_target_profile)
   and 2=(select count(*) from public.direct_conversation_members z where z.conversation_id=c.id)
 limit 1;
 if v_id is null then
  insert into public.direct_conversations default values returning id into v_id;
  insert into public.direct_conversation_members(conversation_id,profile_id) values(v_id,auth.uid()),(v_id,p_target_profile);
 end if;
 return v_id;
end; $$;
revoke all on function public.start_direct_conversation(uuid) from public;
grant execute on function public.start_direct_conversation(uuid) to authenticated;

create or replace function public.send_direct_message(p_conversation_id uuid,p_body text)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
 if not public.is_direct_conversation_member(p_conversation_id) then raise exception 'Conversation access denied'; end if;
 if length(trim(coalesce(p_body,'')))=0 or length(trim(p_body))>4000 then raise exception 'Invalid message'; end if;
 insert into public.direct_messages(conversation_id,sender_id,body) values(p_conversation_id,auth.uid(),trim(p_body)) returning id into v_id;
 return v_id;
end; $$;
revoke all on function public.send_direct_message(uuid,text) from public;
grant execute on function public.send_direct_message(uuid,text) to authenticated;

create or replace function public.network_profile(p_profile_id uuid)
returns jsonb language sql stable security definer set search_path=public as $$
 select case p.role
 when 'professional' then jsonb_build_object(
  'id',p.id,'role',p.role,'first_name',p.first_name,'last_name',p.last_name,'email',p.email,'avatar_url',p.avatar_url,
  'headline',p.headline,'bio',p.bio,'city',p.city,'country',p.country,
  'professional_type',pr.professional_type,'specialty',pr.specialty,'nationality',pr.nationality,'years_experience',pr.years_experience,
  'base_airport_code',pr.base_airport_code,'base_city',pr.base_city,'verification_status',pr.verification_status,
  'license_country',pr.license_country,'license_authority',pr.license_authority)
 when 'company' then jsonb_build_object(
  'id',p.id,'role',p.role,'company_name',c.company_name,'email',p.email,'avatar_url',p.avatar_url,'headline',p.headline,'bio',p.bio,
  'city',p.city,'country',p.country,'company_type',c.company_type,'website',c.website,'verification_status',c.verification_status)
 else null end
 from public.profiles p
 left join public.professionals pr on pr.id=p.id
 left join public.companies c on c.id=p.id
 where p.id=p_profile_id and (
   (p.role='professional' and pr.verification_status='verified') or
   (p.role='company' and c.verification_status='verified') or p.id=auth.uid()
 );
$$;
revoke all on function public.network_profile(uuid) from public;
grant execute on function public.network_profile(uuid) to authenticated;

create or replace function public.network_search_profiles(p_query text default null,p_role public.account_role default null,p_limit integer default 40)
returns table(profile_id uuid,role public.account_role,display_name text,headline text,city text,country text,avatar_url text,subtitle text)
language sql stable security definer set search_path=public as $$
 select p.id,p.role,
  case when p.role='company' then c.company_name else trim(coalesce(p.first_name,'')||' '||coalesce(p.last_name,'')) end as display_name,
  p.headline,p.city,p.country,p.avatar_url,
  case when p.role='company' then c.company_type else concat(pr.professional_type::text,case when pr.specialty is not null then ' · '||pr.specialty else '' end) end
 from public.profiles p left join public.professionals pr on pr.id=p.id left join public.companies c on c.id=p.id
 where p.role in('professional','company')
 and (p_role is null or p.role=p_role)
 and ((p.role='professional' and pr.verification_status='verified') or (p.role='company' and c.verification_status='verified'))
 and (nullif(trim(p_query),'') is null or lower(coalesce(p.first_name,'')||' '||coalesce(p.last_name,'')||' '||coalesce(c.company_name,'')||' '||coalesce(p.headline,'')||' '||coalesce(p.city,'')||' '||coalesce(p.country,'')) like '%'||lower(trim(p_query))||'%')
 order by display_name limit least(greatest(coalesce(p_limit,40),1),100);
$$;
revoke all on function public.network_search_profiles(text,public.account_role,integer) from public;
grant execute on function public.network_search_profiles(text,public.account_role,integer) to authenticated;

create or replace function public.professional_discover_missions(p_query text default null,p_kind text default null,p_limit integer default 60)
returns setof public.missions language sql stable security definer set search_path=public as $$
 select m.* from public.missions m join public.professionals pr on pr.id=auth.uid()
 where pr.verification_status='verified' and m.status in('published','matching') and m.professional_type=pr.professional_type
 and exists(select 1 from public.professional_available_days d where d.professional_id=auth.uid() and d.available_date=(m.departure_at at time zone 'UTC')::date)
 and (p_kind is null or m.mission_kind=p_kind)
 and (
   (m.mission_kind='transport' and nullif(trim(pr.base_airport_code),'') is not null and upper(trim(m.departure_airport_code))=upper(trim(pr.base_airport_code)))
   or (m.mission_kind='event' and (lower(coalesce(m.event_city,''))=lower(coalesce(pr.base_city,'')) or lower(coalesce(m.event_country,''))=lower(coalesce(pr.country_of_operation,''))))
 )
 and (nullif(trim(p_query),'') is null or lower(coalesce(m.title,'')||' '||coalesce(m.departure_location,'')||' '||coalesce(m.destination_location,'')||' '||coalesce(m.event_name,'')||' '||coalesce(m.event_city,'')) like '%'||lower(trim(p_query))||'%')
 order by m.departure_at limit least(greatest(coalesce(p_limit,60),1),100);
$$;
revoke all on function public.professional_discover_missions(text,text,integer) from public;
grant execute on function public.professional_discover_missions(text,text,integer) to authenticated;

create or replace function public.set_my_available_days(p_dates date[])
returns void language plpgsql security definer set search_path=public as $$
begin
 if not exists(select 1 from public.professionals where id=auth.uid()) then raise exception 'Professional account required'; end if;
 delete from public.professional_available_days where professional_id=auth.uid();
 insert into public.professional_available_days(professional_id,available_date)
 select auth.uid(),d from unnest(coalesce(p_dates,'{}'::date[])) d where d>=current_date on conflict do nothing;
end; $$;
revoke all on function public.set_my_available_days(date[]) from public;
grant execute on function public.set_my_available_days(date[]) to authenticated;
