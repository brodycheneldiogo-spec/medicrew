-- Secure company candidate selection and mission confirmation.
create or replace function public.select_mission_professional(p_mission_id uuid, p_professional_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
  v_match_id uuid;
  v_assignment_id uuid;
begin
  select company_id into v_company_id from public.missions where id = p_mission_id;
  if v_company_id is null or v_company_id <> auth.uid() then
    raise exception 'Not authorized to select a professional';
  end if;

  if not exists (select 1 from public.missions where id = p_mission_id and status = 'matching') then
    raise exception 'Mission is not available for selection';
  end if;

  select id into v_match_id
  from public.mission_matches
  where mission_id = p_mission_id and professional_id = p_professional_id and eligible = true;
  if v_match_id is null then
    raise exception 'Professional is not an eligible match';
  end if;

  insert into public.mission_assignments (mission_id, professional_id, confirmed_at)
  values (p_mission_id, p_professional_id, now())
  on conflict (mission_id) do update set professional_id = excluded.professional_id, confirmed_at = now()
  returning id into v_assignment_id;

  update public.missions set status = 'confirmed', updated_at = now() where id = p_mission_id;

  update public.mission_applications
  set status = case when professional_id = p_professional_id then 'accepted' else 'declined' end
  where mission_id = p_mission_id and status = 'pending';

  insert into public.conversations (mission_id) values (p_mission_id) on conflict (mission_id) do nothing;
  insert into public.conversation_members (conversation_id, profile_id)
  select c.id, x.profile_id
  from public.conversations c
  cross join (values (auth.uid()), (p_professional_id)) as x(profile_id)
  where c.mission_id = p_mission_id
  on conflict do nothing;

  insert into public.notifications (profile_id, title, body, type, data)
  values
    (p_professional_id, 'Mission confirmed', 'You have been selected for a MediCrew mission.', 'mission_confirmed', jsonb_build_object('mission_id', p_mission_id)),
    (auth.uid(), 'Professional selected', 'The mission is now confirmed.', 'professional_selected', jsonb_build_object('mission_id', p_mission_id, 'professional_id', p_professional_id));

  return v_assignment_id;
end;
$$;

grant execute on function public.select_mission_professional(uuid, uuid) to authenticated;

-- A company must be verified before it can publish a mission.
create or replace function public.enforce_verified_company_publish()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status in ('published','matching') and old.status not in ('published','matching') then
    if not exists (select 1 from public.companies where id = new.company_id and verification_status = 'verified') then
      raise exception 'Company verification required before publishing missions';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists missions_verified_company_publish on public.missions;
create trigger missions_verified_company_publish
before update on public.missions
for each row execute function public.enforce_verified_company_publish();
