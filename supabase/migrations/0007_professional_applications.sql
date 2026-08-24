-- Professional application workflow. All mutation rules stay server-side.
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

grant execute on function public.apply_to_mission(uuid,text) to authenticated;

create policy "professional creates own applications" on public.mission_applications
for insert with check (professional_id=auth.uid());
create policy "professional reads own applications" on public.mission_applications
for select using (professional_id=auth.uid());
create policy "professional withdraws own pending application" on public.mission_applications
for update using (professional_id=auth.uid() and status='pending')
with check (professional_id=auth.uid() and status in ('pending','withdrawn'));

create policy "users read own notifications" on public.notifications
for select using (profile_id=auth.uid());
create policy "users update own notifications" on public.notifications
for update using (profile_id=auth.uid()) with check (profile_id=auth.uid());

