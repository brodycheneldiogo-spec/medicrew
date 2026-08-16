-- Security hardening: never trust client-provided admin role metadata and constrain marketplace writes.

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  requested_role text := new.raw_user_meta_data->>'role';
  safe_role public.account_role;
begin
  if requested_role = 'company' then
    safe_role := 'company';
  else
    safe_role := 'professional';
  end if;

  insert into public.profiles (id, role, email, first_name, last_name)
  values (new.id, safe_role, new.email, new.raw_user_meta_data->>'first_name', new.raw_user_meta_data->>'last_name');
  return new;
end;
$$;

-- Replace the broad application policy with status-aware policies.
drop policy if exists "professional applications" on public.mission_applications;

create policy "professional can apply to open missions" on public.mission_applications
for insert with check (
  professional_id = auth.uid()
  and exists (
    select 1 from public.professionals p
    where p.id = auth.uid() and p.verification_status = 'verified'
  )
  and exists (
    select 1 from public.missions m
    where m.id = mission_id and m.status in ('published','matching')
  )
);

create policy "professional can read own applications" on public.mission_applications
for select using (professional_id = auth.uid());

create policy "professional can withdraw own application" on public.mission_applications
for update using (professional_id = auth.uid() and status = 'pending')
with check (professional_id = auth.uid() and status in ('pending','withdrawn'));

-- Only the owning company can transition an application to accepted/declined.
drop policy if exists "company updates mission applications" on public.mission_applications;
create policy "company updates mission applications" on public.mission_applications
for update using (
  exists (select 1 from public.missions m where m.id = mission_id and m.company_id = auth.uid())
)
with check (
  exists (select 1 from public.missions m where m.id = mission_id and m.company_id = auth.uid())
  and status in ('pending','accepted','declined')
);
