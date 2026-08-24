create or replace function public.guard_mission_publication()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.status='matching' and coalesce(old.status::text,'')<> 'matching' then
    if new.company_id<>auth.uid() then raise exception 'Only the owning company can publish a mission'; end if;
    if not exists(select 1 from public.companies c where c.id=new.company_id and c.verification_status='verified') then
      raise exception 'Company verification is required before publishing a mission';
    end if;
    if not public.has_current_legal_acceptance(new.company_id) then
      raise exception 'Current legal terms must be accepted before publishing a mission';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.guard_mission_publication() from public;
drop trigger if exists missions_publication_guard on public.missions;
create trigger missions_publication_guard before update of status on public.missions
for each row execute function public.guard_mission_publication();

