create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create policy "professionals can discover published missions" on public.missions
for select using (status in ('published','matching','professional_selected','confirmed','in_progress'));

create policy "professionals can read requirements for discoverable missions" on public.mission_requirements
for select using (exists (
  select 1 from public.missions m
  where m.id = mission_id
    and m.status in ('published','matching','professional_selected','confirmed','in_progress')
));

create policy "professionals can read their matches" on public.mission_matches
for select using (professional_id = auth.uid());

create policy "companies can read mission applications" on public.mission_applications
for select using (exists (select 1 from public.missions m where m.id = mission_id and m.company_id = auth.uid()));

create policy "companies can update mission applications" on public.mission_applications
for update using (exists (select 1 from public.missions m where m.id = mission_id and m.company_id = auth.uid()))
with check (exists (select 1 from public.missions m where m.id = mission_id and m.company_id = auth.uid()));

create policy "mission members can read conversations" on public.conversations
for select using (exists (select 1 from public.conversation_members cm where cm.conversation_id = id and cm.profile_id = auth.uid()));

create policy "mission members can read membership" on public.conversation_members
for select using (profile_id = auth.uid());

create policy "mission members can send messages" on public.messages
for insert with check (sender_id = auth.uid() and exists (select 1 from public.conversation_members cm where cm.conversation_id = conversation_id and cm.profile_id = auth.uid()));

create policy "mission members can read messages" on public.messages
for select using (exists (select 1 from public.conversation_members cm where cm.conversation_id = conversation_id and cm.profile_id = auth.uid()));

create policy "admins full profiles" on public.profiles for all using (public.is_admin()) with check (public.is_admin());
create policy "admins full professionals" on public.professionals for all using (public.is_admin()) with check (public.is_admin());
create policy "admins full companies" on public.companies for all using (public.is_admin()) with check (public.is_admin());
create policy "admins full skills" on public.skills for all using (public.is_admin()) with check (public.is_admin());
create policy "admins full professional skills" on public.professional_skills for all using (public.is_admin()) with check (public.is_admin());
create policy "admins full professional languages" on public.professional_languages for all using (public.is_admin()) with check (public.is_admin());
create policy "admins full certifications" on public.professional_certifications for all using (public.is_admin()) with check (public.is_admin());
create policy "admins full availability" on public.professional_availability for all using (public.is_admin()) with check (public.is_admin());
create policy "admins full missions" on public.missions for all using (public.is_admin()) with check (public.is_admin());
create policy "admins full requirements" on public.mission_requirements for all using (public.is_admin()) with check (public.is_admin());
create policy "admins full applications" on public.mission_applications for all using (public.is_admin()) with check (public.is_admin());
create policy "admins full matches" on public.mission_matches for all using (public.is_admin()) with check (public.is_admin());
create policy "admins full assignments" on public.mission_assignments for all using (public.is_admin()) with check (public.is_admin());
create policy "admins full conversations" on public.conversations for all using (public.is_admin()) with check (public.is_admin());
create policy "admins full conversation members" on public.conversation_members for all using (public.is_admin()) with check (public.is_admin());
create policy "admins full messages" on public.messages for all using (public.is_admin()) with check (public.is_admin());
create policy "admins full notifications" on public.notifications for all using (public.is_admin()) with check (public.is_admin());
create policy "admins full audit logs" on public.audit_logs for all using (public.is_admin()) with check (public.is_admin());

