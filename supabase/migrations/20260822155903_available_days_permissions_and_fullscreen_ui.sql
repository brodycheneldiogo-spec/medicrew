alter table public.professional_available_days enable row level security;

grant select, insert, update, delete
on table public.professional_available_days
to authenticated;

drop policy if exists professional_available_days_owner on public.professional_available_days;
create policy professional_available_days_owner
on public.professional_available_days
for all
to authenticated
using ((select auth.uid()) = professional_id)
with check ((select auth.uid()) = professional_id);
