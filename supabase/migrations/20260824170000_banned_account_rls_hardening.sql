-- Enforce permanent application bans below the UI layer.

create or replace function public.reject_banned_actor()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is not null and public.profile_is_banned(auth.uid()) then
    raise exception 'This MediCrew account has been permanently banned';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function public.reject_banned_actor() from public, anon, authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles', 'professionals', 'companies', 'missions',
    'mission_applications', 'professional_availability',
    'professional_available_days', 'direct_conversations',
    'direct_conversation_members', 'direct_messages'
  ] loop
    if to_regclass('public.' || table_name) is not null then
      execute format('drop trigger if exists reject_banned_actor on public.%I', table_name);
      execute format(
        'create trigger reject_banned_actor before insert or update or delete on public.%I for each row execute function public.reject_banned_actor()',
        table_name
      );
    end if;
  end loop;
end;
$$;

-- Remove the older permissive profile policy that bypassed the active-account rule.
drop policy if exists profiles_owner_update on public.profiles;

alter policy "profiles self read" on public.profiles
  using (id = auth.uid() and public.caller_is_active());

alter policy "company self read" on public.companies
  using (id = auth.uid() and public.caller_is_active());
alter policy "company self insert" on public.companies
  with check (id = auth.uid() and public.caller_is_active());
alter policy "company self update" on public.companies
  using (id = auth.uid() and public.caller_is_active())
  with check (id = auth.uid() and public.caller_is_active());

alter policy "professional self read" on public.professionals
  using (id = auth.uid() and public.caller_is_active());
alter policy "professional self insert" on public.professionals
  with check (id = auth.uid() and public.caller_is_active());
alter policy "professional self update" on public.professionals
  using (id = auth.uid() and public.caller_is_active())
  with check (id = auth.uid() and public.caller_is_active());

alter policy professional_available_days_owner on public.professional_available_days
  using (professional_id = auth.uid() and public.caller_is_active())
  with check (professional_id = auth.uid() and public.caller_is_active());

alter policy direct_conversations_member_read on public.direct_conversations
  using (public.caller_is_active() and public.is_direct_conversation_member(id));

alter policy "company missions" on public.missions
  using (company_id = auth.uid() and public.caller_is_active())
  with check (company_id = auth.uid() and public.caller_is_active());

alter policy "professional reads event mission fields" on public.missions
  using (
    public.caller_is_active()
    and mission_kind = 'event'
    and status = any(array['published','matching','professional_selected','confirmed','in_progress','completed']::public.mission_status[])
    and exists (select 1 from public.professionals p where p.id = auth.uid())
  );

alter policy "professional reads published missions" on public.missions
  using (
    public.caller_is_active()
    and status = any(array['published','matching','professional_selected','confirmed','in_progress','completed']::public.mission_status[])
    and exists (select 1 from public.professionals p where p.id = auth.uid())
  );

alter policy "professionals can discover published missions" on public.missions
  using (
    public.caller_is_active()
    and status = any(array['published','matching','professional_selected','confirmed','in_progress']::public.mission_status[])
  );
