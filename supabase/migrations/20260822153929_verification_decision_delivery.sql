-- Older cached clients can still post an acceptance. RLS continues to require
-- profile_id = auth.uid(); this grant only exposes INSERT/SELECT to that policy.
grant select, insert on table public.legal_acceptances to authenticated;

create or replace function public.dedupe_verification_notifications()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.type in ('professional_verification','company_verification')
     and new.data ? 'status'
     and exists(
       select 1 from public.notifications n
       where n.profile_id=new.profile_id and n.type=new.type
         and n.data->>'status'=new.data->>'status'
         and n.created_at>=now()-interval '1 minute'
     ) then return null;
  end if;
  return new;
end;
$$;
revoke all on function public.dedupe_verification_notifications() from public,anon,authenticated;
drop trigger if exists notifications_dedupe_verification on public.notifications;
create trigger notifications_dedupe_verification before insert on public.notifications
for each row execute function public.dedupe_verification_notifications();

-- Make final account decisions explicit transactional messages. The existing
-- notification triggers enqueue both push delivery and email delivery.
create or replace function public.notify_professional_verification_decision()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.verification_status is distinct from old.verification_status
     and new.verification_status in ('verified','rejected') then
    insert into public.notifications(profile_id,title,body,type,data)
    values(
      new.id,
      case new.verification_status when 'verified' then 'Your MediCrew profile is approved' else 'Your MediCrew profile was not approved' end,
      case new.verification_status when 'verified' then 'Your professional file has been accepted. You can now access verified MediCrew missions.' else 'Your professional file has been rejected. Open MediCrew to review your information and submit corrected documents.' end,
      'professional_verification',
      jsonb_build_object('status',new.verification_status,'email',true,'url','/pending-review')
    );
  end if;
  return new;
end;
$$;
revoke all on function public.notify_professional_verification_decision() from public,anon,authenticated;
drop trigger if exists professionals_notify_final_decision on public.professionals;
create trigger professionals_notify_final_decision
after update of verification_status on public.professionals
for each row execute function public.notify_professional_verification_decision();

create or replace function public.notify_company_verification_decision()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.verification_status is distinct from old.verification_status
     and new.verification_status in ('verified','rejected') then
    insert into public.notifications(profile_id,title,body,type,data)
    values(
      new.id,
      case new.verification_status when 'verified' then 'Your MediCrew organization is approved' else 'Your MediCrew organization was not approved' end,
      case new.verification_status when 'verified' then 'Your organization file has been accepted. You can now use the verified MediCrew company workspace.' else 'Your organization file has been rejected. Open MediCrew to review your information and submit corrected documents.' end,
      'company_verification',
      jsonb_build_object('status',new.verification_status,'email',true,'url','/pending-review')
    );
  end if;
  return new;
end;
$$;
revoke all on function public.notify_company_verification_decision() from public,anon,authenticated;
drop trigger if exists companies_notify_final_decision on public.companies;
create trigger companies_notify_final_decision
after update of verification_status on public.companies
for each row execute function public.notify_company_verification_decision();
