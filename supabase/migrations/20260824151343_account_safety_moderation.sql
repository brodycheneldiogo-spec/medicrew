-- Account safety: private reports, reciprocal blocks and application-level permanent bans.

alter table public.profiles
  add column if not exists is_banned boolean not null default false,
  add column if not exists banned_at timestamptz,
  add column if not exists banned_reason text,
  add column if not exists banned_by uuid references public.profiles(id) on delete set null;

create table if not exists public.user_blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint user_blocks_not_self check (blocker_id <> blocked_id)
);

create table if not exists public.user_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles(id) on delete set null,
  reported_id uuid references public.profiles(id) on delete set null,
  conversation_id uuid references public.direct_conversations(id) on delete set null,
  reason text not null check (reason in ('harassment','spam','fraud','impersonation','unsafe_behavior','inappropriate_content','other')),
  explanation text not null check (length(trim(explanation)) between 10 and 2000),
  status text not null default 'pending' check (status in ('pending','reviewed','dismissed','actioned')),
  reporter_email_snapshot text,
  reported_email_snapshot text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_blocks_blocked_idx on public.user_blocks(blocked_id, blocker_id);
create index if not exists user_reports_reporter_idx on public.user_reports(reporter_id, created_at desc);
create index if not exists user_reports_pending_idx on public.user_reports(created_at desc) where status='pending';
create index if not exists user_reports_reported_idx on public.user_reports(reported_id, created_at desc);
create index if not exists profiles_banned_idx on public.profiles(banned_at desc) where is_banned;

alter table public.user_blocks enable row level security;
alter table public.user_reports enable row level security;

drop policy if exists user_blocks_owner_read on public.user_blocks;
create policy user_blocks_owner_read on public.user_blocks for select to authenticated
using ((select auth.uid()) = blocker_id);

drop policy if exists user_reports_reporter_read on public.user_reports;
create policy user_reports_reporter_read on public.user_reports for select to authenticated
using ((select auth.uid()) = reporter_id);

revoke all on public.user_blocks, public.user_reports from anon, authenticated;
grant select on public.user_blocks, public.user_reports to authenticated;

create or replace function public.profile_is_banned(p_profile_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select coalesce((select p.is_banned from public.profiles p where p.id=p_profile_id),true)
$$;
revoke all on function public.profile_is_banned(uuid) from public,anon;
grant execute on function public.profile_is_banned(uuid) to authenticated;

create or replace function public.caller_is_active()
returns boolean language sql stable security definer set search_path=public as $$
  select auth.uid() is not null and not public.profile_is_banned(auth.uid())
$$;
revoke all on function public.caller_is_active() from public,anon;
grant execute on function public.caller_is_active() to authenticated;

create or replace function public.users_are_blocked(p_first uuid,p_second uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from public.user_blocks b
    where (b.blocker_id=p_first and b.blocked_id=p_second)
       or (b.blocker_id=p_second and b.blocked_id=p_first)
  )
$$;
revoke all on function public.users_are_blocked(uuid,uuid) from public,anon;
grant execute on function public.users_are_blocked(uuid,uuid) to authenticated;

create or replace function public.set_user_block(p_target_profile uuid,p_blocked boolean default true)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.caller_is_active() then raise exception 'Account unavailable'; end if;
  if p_target_profile is null or p_target_profile=auth.uid() then raise exception 'Invalid block target'; end if;
  if not exists(select 1 from public.profiles p where p.id=p_target_profile and p.role in('professional','company') and not p.is_banned) then raise exception 'Profile unavailable'; end if;
  if coalesce(p_blocked,true) then
    insert into public.user_blocks(blocker_id,blocked_id) values(auth.uid(),p_target_profile) on conflict do nothing;
  else
    delete from public.user_blocks where blocker_id=auth.uid() and blocked_id=p_target_profile;
  end if;
end;$$;
revoke all on function public.set_user_block(uuid,boolean) from public,anon;
grant execute on function public.set_user_block(uuid,boolean) to authenticated;

create or replace function public.user_relationship_state(p_target_profile uuid)
returns jsonb language sql stable security definer set search_path=public as $$
  select jsonb_build_object(
    'blocked_by_me',exists(select 1 from public.user_blocks where blocker_id=auth.uid() and blocked_id=p_target_profile),
    'blocked_either_way',public.users_are_blocked(auth.uid(),p_target_profile),
    'target_available',exists(select 1 from public.profiles where id=p_target_profile and not is_banned)
  )
$$;
revoke all on function public.user_relationship_state(uuid) from public,anon;
grant execute on function public.user_relationship_state(uuid) to authenticated;

create or replace function public.submit_user_report(
  p_target_profile uuid,
  p_reason text,
  p_explanation text,
  p_conversation_id uuid default null
) returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid;v_reporter_email text;v_reported_email text;
begin
  if not public.caller_is_active() then raise exception 'Account unavailable'; end if;
  if p_target_profile is null or p_target_profile=auth.uid() then raise exception 'Invalid report target'; end if;
  if p_reason not in ('harassment','spam','fraud','impersonation','unsafe_behavior','inappropriate_content','other') then raise exception 'Invalid report reason'; end if;
  if length(trim(coalesce(p_explanation,''))) not between 10 and 2000 then raise exception 'Explanation must contain between 10 and 2000 characters'; end if;
  if not exists(select 1 from public.profiles where id=p_target_profile and role in('professional','company')) then raise exception 'Profile unavailable'; end if;
  if p_conversation_id is not null and not (
    public.is_direct_conversation_member(p_conversation_id)
    and exists(select 1 from public.direct_conversation_members where conversation_id=p_conversation_id and profile_id=p_target_profile)
  ) then raise exception 'Conversation does not match the reported user'; end if;
  if exists(select 1 from public.user_reports where reporter_id=auth.uid() and reported_id=p_target_profile and status='pending' and created_at>now()-interval '24 hours') then raise exception 'A recent report for this profile is already under review'; end if;
  select email into v_reporter_email from public.profiles where id=auth.uid();
  select email into v_reported_email from public.profiles where id=p_target_profile;
  insert into public.user_reports(reporter_id,reported_id,conversation_id,reason,explanation,reporter_email_snapshot,reported_email_snapshot)
  values(auth.uid(),p_target_profile,p_conversation_id,p_reason,trim(p_explanation),v_reporter_email,v_reported_email)
  returning id into v_id;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(auth.uid(),'user_report_submitted','user_report',v_id,jsonb_build_object('reported_id',p_target_profile,'reason',p_reason));
  return v_id;
end;$$;
revoke all on function public.submit_user_report(uuid,text,text,uuid) from public,anon;
grant execute on function public.submit_user_report(uuid,text,text,uuid) to authenticated;

create or replace function public.direct_conversation_context(p_conversation_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare v_other uuid;v_name text;v_role public.account_role;
begin
  if not public.is_direct_conversation_member(p_conversation_id) then raise exception 'Conversation access denied'; end if;
  select m.profile_id,p.role,
    case when p.role='company' then c.company_name else trim(coalesce(p.first_name,'')||' '||coalesce(p.last_name,'')) end
  into v_other,v_role,v_name
  from public.direct_conversation_members m join public.profiles p on p.id=m.profile_id left join public.companies c on c.id=p.id
  where m.conversation_id=p_conversation_id and m.profile_id<>auth.uid() limit 1;
  return jsonb_build_object('other_profile_id',v_other,'display_name',v_name,'role',v_role,'blocked_by_me',exists(select 1 from public.user_blocks where blocker_id=auth.uid() and blocked_id=v_other),'blocked_either_way',public.users_are_blocked(auth.uid(),v_other));
end;$$;
revoke all on function public.direct_conversation_context(uuid) from public,anon;
grant execute on function public.direct_conversation_context(uuid) to authenticated;

create or replace function public.admin_report_queue()
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare v_result jsonb;
begin
  if not exists(select 1 from public.profiles where id=auth.uid() and role='admin' and not is_banned) then raise exception 'Admin access required'; end if;
  select coalesce(jsonb_agg(to_jsonb(q) order by q.created_at desc),'[]'::jsonb) into v_result
  from (
    select r.id,r.reporter_id,r.reported_id,r.conversation_id,r.reason,r.explanation,r.status,r.created_at,r.reviewed_at,r.admin_note,
      coalesce(nullif(trim(coalesce(rp.first_name,'')||' '||coalesce(rp.last_name,'')),''),rc.company_name,r.reporter_email_snapshot,'Deleted user') reporter_name,
      coalesce(nullif(trim(coalesce(tp.first_name,'')||' '||coalesce(tp.last_name,'')),''),tc.company_name,r.reported_email_snapshot,'Deleted user') reported_name,
      coalesce(rp.email,r.reporter_email_snapshot) reporter_email,
      coalesce(tp.email,r.reported_email_snapshot) reported_email,
      coalesce(tp.is_banned,false) reported_is_banned,
      count(*) over(partition by r.reported_id) report_count
    from public.user_reports r
    left join public.profiles rp on rp.id=r.reporter_id left join public.companies rc on rc.id=rp.id
    left join public.profiles tp on tp.id=r.reported_id left join public.companies tc on tc.id=tp.id
  ) q;
  return v_result;
end;$$;
revoke all on function public.admin_report_queue() from public,anon;
grant execute on function public.admin_report_queue() to authenticated;

create or replace function public.admin_permanently_ban_user(p_profile_id uuid,p_reason text)
returns void language plpgsql security definer set search_path=public as $$
declare v_email text;
begin
  if not exists(select 1 from public.profiles where id=auth.uid() and role='admin' and not is_banned) then raise exception 'Admin access required'; end if;
  if p_profile_id=auth.uid() or exists(select 1 from public.profiles where id=p_profile_id and role='admin') then raise exception 'Admin accounts cannot be banned here'; end if;
  if length(trim(coalesce(p_reason,''))) not between 5 and 500 then raise exception 'A clear ban reason is required'; end if;
  update public.profiles set is_banned=true,banned_at=now(),banned_reason=trim(p_reason),banned_by=auth.uid(),updated_at=now() where id=p_profile_id returning email into v_email;
  if not found then raise exception 'Profile not found'; end if;
  update public.professionals set verification_status='suspended',updated_at=now() where id=p_profile_id;
  update public.companies set verification_status='suspended',updated_at=now() where id=p_profile_id;
  update public.user_reports set status='actioned',reviewed_by=auth.uid(),reviewed_at=now(),admin_note='Account permanently banned',updated_at=now() where reported_id=p_profile_id and status in('pending','reviewed');
  insert into public.notifications(profile_id,title,body,type,data)
  values(p_profile_id,'Your MediCrew account has been permanently banned','Reason: '||trim(p_reason),'account_banned',jsonb_build_object('reason',trim(p_reason),'email',true,'recipient_email',v_email,'url','/banned'));
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(auth.uid(),'account_permanently_banned','profile',p_profile_id,jsonb_build_object('reason',trim(p_reason)));
end;$$;
revoke all on function public.admin_permanently_ban_user(uuid,text) from public,anon;
grant execute on function public.admin_permanently_ban_user(uuid,text) to authenticated;

create or replace function public.my_account_access_state()
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare v_uid uuid:=auth.uid();v_role public.account_role;v_status public.verification_status;v_submitted timestamptz;v_email text;v_banned boolean;v_reason text;v_banned_at timestamptz;
begin
  if v_uid is null then return jsonb_build_object('authenticated',false); end if;
  select role,email,is_banned,banned_reason,banned_at into v_role,v_email,v_banned,v_reason,v_banned_at from public.profiles where id=v_uid;
  if coalesce(v_banned,false) then return jsonb_build_object('authenticated',true,'role',v_role,'status','banned','allowed',false,'email',v_email,'reason',v_reason,'banned_at',v_banned_at); end if;
  if v_role='admin' then return jsonb_build_object('authenticated',true,'role','admin','status','verified','allowed',true,'email',v_email); end if;
  if v_role='professional' then select verification_status,review_submitted_at into v_status,v_submitted from public.professionals where id=v_uid;
  elsif v_role='company' then select verification_status,review_submitted_at into v_status,v_submitted from public.companies where id=v_uid;
  else return jsonb_build_object('authenticated',true,'role',v_role,'status','incomplete','allowed',false,'email',v_email); end if;
  return jsonb_build_object('authenticated',true,'role',v_role,'status',coalesce(v_status::text,'incomplete'),'allowed',v_status='verified','submitted_at',v_submitted,'email',v_email);
end;$$;
revoke all on function public.my_account_access_state() from public,anon;
grant execute on function public.my_account_access_state() to authenticated;

create or replace function public.caller_has_verified_network_access()
returns boolean language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from public.profiles p
    left join public.professionals pr on pr.id=p.id left join public.companies c on c.id=p.id
    where p.id=auth.uid() and not p.is_banned and (
      p.role='admin' or
      (p.role='professional' and pr.verification_status='verified' and public.professional_has_current_launch_evidence(p.id)) or
      (p.role='company' and c.verification_status='verified')
    )
  )
$$;
revoke all on function public.caller_has_verified_network_access() from public,anon;
grant execute on function public.caller_has_verified_network_access() to authenticated;

create or replace function public.start_direct_conversation(p_target_profile uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid;v_me public.account_role;v_target public.account_role;
begin
  if not public.caller_has_verified_network_access() then raise exception 'Verified MediCrew access required'; end if;
  if p_target_profile is null or p_target_profile=auth.uid() then raise exception 'Invalid conversation target'; end if;
  if public.profile_is_banned(p_target_profile) then raise exception 'Profile unavailable'; end if;
  if public.users_are_blocked(auth.uid(),p_target_profile) then raise exception 'Messaging is unavailable between these profiles'; end if;
  select role into v_me from public.profiles where id=auth.uid();select role into v_target from public.profiles where id=p_target_profile;
  if v_target is null then raise exception 'Profile not found'; end if;
  if v_me='company' and v_target='company' then raise exception 'Organization-to-organization messaging is not supported'; end if;
  if v_target='professional' and not exists(select 1 from public.professionals where id=p_target_profile and verification_status='verified') then raise exception 'Target professional is not verified'; end if;
  if v_target='company' and not exists(select 1 from public.companies where id=p_target_profile and verification_status='verified') then raise exception 'Target organization is not verified'; end if;
  select c.id into v_id from public.direct_conversations c where exists(select 1 from public.direct_conversation_members a where a.conversation_id=c.id and a.profile_id=auth.uid()) and exists(select 1 from public.direct_conversation_members b where b.conversation_id=c.id and b.profile_id=p_target_profile) and 2=(select count(*) from public.direct_conversation_members z where z.conversation_id=c.id) limit 1;
  if v_id is null then insert into public.direct_conversations default values returning id into v_id;insert into public.direct_conversation_members(conversation_id,profile_id) values(v_id,auth.uid()),(v_id,p_target_profile);end if;
  return v_id;
end;$$;
revoke all on function public.start_direct_conversation(uuid) from public,anon;
grant execute on function public.start_direct_conversation(uuid) to authenticated;

create or replace function public.send_direct_message(p_conversation_id uuid,p_body text)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid;v_other uuid;
begin
  if not public.caller_has_verified_network_access() or not public.is_direct_conversation_member(p_conversation_id) then raise exception 'Conversation access denied'; end if;
  select profile_id into v_other from public.direct_conversation_members where conversation_id=p_conversation_id and profile_id<>auth.uid() limit 1;
  if v_other is null or public.profile_is_banned(v_other) or public.users_are_blocked(auth.uid(),v_other) then raise exception 'Messaging is unavailable between these profiles'; end if;
  if length(trim(coalesce(p_body,'')))=0 or length(trim(p_body))>4000 then raise exception 'Invalid message'; end if;
  insert into public.direct_messages(conversation_id,sender_id,body) values(p_conversation_id,auth.uid(),trim(p_body)) returning id into v_id;
  return v_id;
end;$$;
revoke all on function public.send_direct_message(uuid,text) from public,anon;
grant execute on function public.send_direct_message(uuid,text) to authenticated;

drop policy if exists direct_messages_member_read on public.direct_messages;
create policy direct_messages_member_read on public.direct_messages for select to authenticated
using (public.caller_is_active() and public.is_direct_conversation_member(conversation_id));

create or replace function public.network_search_profiles(p_query text default null,p_role public.account_role default null,p_limit integer default 40)
returns table(profile_id uuid,role public.account_role,display_name text,headline text,city text,country text,avatar_url text,subtitle text)
language sql stable security definer set search_path=public as $$
 select p.id,p.role,
  case when p.role='company' then c.company_name else trim(coalesce(p.first_name,'')||' '||coalesce(p.last_name,'')) end,
  p.headline,p.city,p.country,p.avatar_url,
  case when p.role='company' then case when c.company_type='event' then 'Event medical staffing' else 'Medical transport' end else concat(case when pr.professional_type='nurse' then 'Nurse' else 'Doctor' end,case when pr.specialty is not null then ' · '||pr.specialty else '' end) end
 from public.profiles p left join public.professionals pr on pr.id=p.id left join public.companies c on c.id=p.id
 where public.caller_has_verified_network_access() and p.role in('professional','company') and not p.is_banned and p.id<>auth.uid()
   and not public.users_are_blocked(auth.uid(),p.id)
   and (p_role is null or p.role=p_role)
   and ((p.role='professional' and public.professional_has_current_launch_evidence(p.id)) or (p.role='company' and c.verification_status='verified'))
   and (nullif(trim(p_query),'') is null or lower(coalesce(p.first_name,'')||' '||coalesce(p.last_name,'')||' '||coalesce(c.company_name,'')||' '||coalesce(p.headline,'')||' '||coalesce(p.city,'')||' '||coalesce(p.country,'')||' '||coalesce(pr.specialty,'')) like '%'||lower(trim(p_query))||'%')
 order by lower(case when p.role='company' then coalesce(c.company_name,'') else trim(coalesce(p.last_name,'')||' '||coalesce(p.first_name,'')) end)
 limit least(greatest(coalesce(p_limit,40),1),100);
$$;
revoke all on function public.network_search_profiles(text,public.account_role,integer) from public,anon;
grant execute on function public.network_search_profiles(text,public.account_role,integer) to authenticated;

create or replace function public.network_profile(p_profile_id uuid)
returns jsonb language sql stable security definer set search_path=public as $$
 select case p.role
 when 'professional' then jsonb_build_object('id',p.id,'role',p.role,'first_name',p.first_name,'last_name',p.last_name,'email',p.email,'avatar_url',p.avatar_url,'headline',p.headline,'bio',p.bio,'city',p.city,'country',p.country,'professional_type',pr.professional_type,'specialty',pr.specialty,'nationality',pr.nationality,'years_experience',pr.years_experience,'base_airport_code',pr.base_airport_code,'base_city',pr.base_city,'verification_status',pr.verification_status,'license_country',pr.license_country,'license_authority',pr.license_authority)
 when 'company' then jsonb_build_object('id',p.id,'role',p.role,'company_name',c.company_name,'email',p.email,'avatar_url',p.avatar_url,'headline',p.headline,'bio',p.bio,'city',p.city,'country',p.country,'company_type',c.company_type,'website',c.website,'verification_status',c.verification_status)
 else null end
 from public.profiles p left join public.professionals pr on pr.id=p.id left join public.companies c on c.id=p.id
 where public.caller_has_verified_network_access() and p.id=p_profile_id and not p.is_banned and not public.users_are_blocked(auth.uid(),p.id)
 and ((p.role='professional' and pr.verification_status='verified') or (p.role='company' and c.verification_status='verified') or p.id=auth.uid());
$$;
revoke all on function public.network_profile(uuid) from public,anon;
grant execute on function public.network_profile(uuid) to authenticated;

create or replace function public.my_direct_conversations()
returns table(conversation_id uuid,other_profile_id uuid,display_name text,avatar_url text,role public.account_role,last_message text,last_message_at timestamptz)
language sql stable security definer set search_path=public as $$
 select c.id,other.profile_id,
   case when p.role='company' then co.company_name else trim(coalesce(p.first_name,'')||' '||coalesce(p.last_name,'')) end,
   p.avatar_url,p.role,
   (select dm.body from public.direct_messages dm where dm.conversation_id=c.id order by dm.created_at desc limit 1),
   (select dm.created_at from public.direct_messages dm where dm.conversation_id=c.id order by dm.created_at desc limit 1)
 from public.direct_conversations c
 join public.direct_conversation_members mine on mine.conversation_id=c.id and mine.profile_id=auth.uid()
 join public.direct_conversation_members other on other.conversation_id=c.id and other.profile_id<>auth.uid()
 join public.profiles p on p.id=other.profile_id left join public.companies co on co.id=p.id
 where public.caller_is_active() and not p.is_banned and not public.users_are_blocked(auth.uid(),other.profile_id)
 order by 7 desc nulls last,c.created_at desc;
$$;
revoke all on function public.my_direct_conversations() from public,anon;
grant execute on function public.my_direct_conversations() to authenticated;

-- Keep an authenticated banned account readable only enough to show its ban message.
drop policy if exists "profiles self update" on public.profiles;
drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update_active on public.profiles for update to authenticated
using(id=(select auth.uid()) and not is_banned)
with check(id=(select auth.uid()) and not is_banned);
