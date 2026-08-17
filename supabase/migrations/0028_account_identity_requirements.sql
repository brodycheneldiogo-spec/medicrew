-- MediCrew account identity hardening.
-- New accounts must complete phone verification plus email/password setup before
-- they can behave as marketplace-ready professionals.

create or replace function public.sync_profile_auth_identity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set email = nullif(trim(new.email), ''),
      phone = nullif(trim(new.phone), ''),
      updated_at = now()
  where id = new.id;
  return new;
end;
$$;

drop trigger if exists sync_profile_auth_identity on auth.users;
create trigger sync_profile_auth_identity
after update of email, phone on auth.users
for each row execute function public.sync_profile_auth_identity();

create or replace function public.professional_account_ready(p_professional_id uuid default auth.uid())
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_role public.account_role;
  v_email text;
  v_phone text;
  v_signup_complete boolean;
begin
  if p_professional_id is null then return false; end if;

  select role, email, phone
    into v_role, v_email, v_phone
  from public.profiles
  where id = p_professional_id;

  if v_role <> 'professional' then return false; end if;
  if nullif(trim(v_email), '') is null or nullif(trim(v_phone), '') is null then return false; end if;

  select coalesce((raw_user_meta_data->>'signup_complete')::boolean, false)
    into v_signup_complete
  from auth.users
  where id = p_professional_id;

  return coalesce(v_signup_complete, false);
end;
$$;

revoke all on function public.professional_account_ready(uuid) from public;
grant execute on function public.professional_account_ready(uuid) to authenticated;

-- Prevent incomplete professionals from ever becoming eligible matches,
-- even if a company publishes a mission while an account is incomplete.
create or replace function public.guard_incomplete_professional_match()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.eligible and not public.professional_account_ready(new.professional_id) then
    new.eligible := false;
    new.reasons := array_append(coalesce(new.reasons, '{}'), 'Account setup incomplete');
  end if;
  return new;
end;
$$;

drop trigger if exists mission_match_account_ready_guard on public.mission_matches;
create trigger mission_match_account_ready_guard
before insert or update of eligible, professional_id on public.mission_matches
for each row execute function public.guard_incomplete_professional_match();

-- Application RPC: a professional must have both required account credentials
-- before applying to a mission.
create or replace function public.apply_to_mission(p_mission_id uuid, p_cover_note text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_type public.professional_type;
  v_mission_type public.professional_type;
  v_status public.mission_status;
begin
  if not public.professional_account_ready(auth.uid()) then
    raise exception 'Complete phone, email and password setup before using the professional marketplace';
  end if;

  select professional_type into v_type from public.professionals
  where id = auth.uid() and verification_status = 'verified';
  if v_type is null then raise exception 'Verified professional account required'; end if;

  select professional_type, status into v_mission_type, v_status
  from public.missions where id = p_mission_id;
  if v_status is null then raise exception 'Mission not found'; end if;
  if v_status not in ('published','matching') then raise exception 'Mission is not accepting applications'; end if;
  if v_type <> v_mission_type then raise exception 'Professional type does not match mission'; end if;

  if not exists (
    select 1 from public.mission_matches
    where mission_id=p_mission_id and professional_id=auth.uid() and eligible=true
  ) then raise exception 'You are not an eligible match for this mission'; end if;

  insert into public.mission_applications(mission_id,professional_id,cover_note)
  values(p_mission_id,auth.uid(),nullif(trim(p_cover_note),''))
  on conflict (mission_id,professional_id) do update
    set status='pending', cover_note=excluded.cover_note
  returning id into v_id;

  insert into public.notifications(profile_id,title,body,type,data)
  select m.company_id,'New mission application','A matched professional applied to your mission.','mission_application',jsonb_build_object('mission_id',p_mission_id,'professional_id',auth.uid())
  from public.missions m where m.id=p_mission_id;
  return v_id;
end;
$$;

revoke all on function public.apply_to_mission(uuid,text) from public;
grant execute on function public.apply_to_mission(uuid,text) to authenticated;

-- Open mission discovery is also restricted to completed professional accounts.
drop policy if exists "professionals discover open missions" on public.missions;
create policy "professionals discover open missions" on public.missions
for select using (
  status in ('published','matching')
  and public.professional_account_ready(auth.uid())
);

-- Keep profile identity synchronized for future Auth changes.
update public.profiles p
set email = nullif(trim(u.email), ''),
    phone = nullif(trim(u.phone), ''),
    updated_at = now()
from auth.users u
where u.id = p.id
  and (p.email is distinct from nullif(trim(u.email), '') or p.phone is distinct from nullif(trim(u.phone), ''));
