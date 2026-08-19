-- Final production hardening.
-- Adds legal acceptance records, designated admin bootstrap, transactional email queue,
-- and a server-side payment gate before a mission can start.

create table if not exists public.legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  terms_version text not null,
  privacy_version text not null,
  data_policy_version text not null,
  accepted_at timestamptz not null default now(),
  ip_address inet,
  user_agent text
);
create index if not exists legal_acceptances_profile_idx on public.legal_acceptances(profile_id, accepted_at desc);
alter table public.legal_acceptances enable row level security;
drop policy if exists legal_acceptances_owner_select on public.legal_acceptances;
drop policy if exists legal_acceptances_owner_insert on public.legal_acceptances;
drop policy if exists legal_acceptances_admin_select on public.legal_acceptances;
create policy legal_acceptances_owner_select on public.legal_acceptances for select to authenticated using(profile_id=auth.uid());
create policy legal_acceptances_owner_insert on public.legal_acceptances for insert to authenticated with check(profile_id=auth.uid());
create policy legal_acceptances_admin_select on public.legal_acceptances for select to authenticated using(exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'));

create or replace function public.has_current_legal_acceptance(p_profile_id uuid default auth.uid())
returns boolean language sql security definer set search_path=public stable as $$
  select exists(
    select 1 from public.legal_acceptances
    where profile_id=p_profile_id
      and terms_version='2.0'
      and privacy_version='1.2'
      and data_policy_version='1.1'
  );
$$;
revoke all on function public.has_current_legal_acceptance(uuid) from public;
grant execute on function public.has_current_legal_acceptance(uuid) to authenticated;

-- Automatically promote the designated operations account when its profile is created or updated.
create or replace function public.bootstrap_designated_admin()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if lower(coalesce(new.email,''))='ethanbrody@gmail.com'
     and regexp_replace(coalesce(new.phone,''),'[^0-9+]','','g') in ('0674356279','+33674356279') then
    new.role := 'admin';
  end if;
  return new;
end;
$$;
revoke all on function public.bootstrap_designated_admin() from public;
drop trigger if exists profiles_designated_admin on public.profiles;
create trigger profiles_designated_admin before insert or update of email,phone on public.profiles
for each row execute function public.bootstrap_designated_admin();

-- Also promote the already-created account, if it exists.
update public.profiles p
set role='admin'
where lower(coalesce(p.email,''))='ethanbrody@gmail.com'
  and regexp_replace(coalesce(p.phone,''),'[^0-9+]','','g') in ('0674356279','+33674356279');

-- Transactional email queue. Only notifications explicitly marked email=true are mailed.
create table if not exists public.notification_email_queue (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  recipient_email text not null,
  subject text not null,
  body_text text not null,
  body_html text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  failed_at timestamptz,
  error_message text
);
create index if not exists notification_email_queue_pending_idx on public.notification_email_queue(created_at) where sent_at is null and failed_at is null;
alter table public.notification_email_queue enable row level security;
drop policy if exists notification_email_queue_owner_select on public.notification_email_queue;
create policy notification_email_queue_owner_select on public.notification_email_queue for select to authenticated using(profile_id=auth.uid());

create or replace function public.enqueue_transactional_email()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_email text;
begin
  if coalesce((new.data->>'email')::boolean,false) then
    select email into v_email from public.profiles where id=new.profile_id;
    if coalesce(trim(v_email),'')<>'' then
      insert into public.notification_email_queue(profile_id,recipient_email,subject,body_text,body_html)
      values(new.profile_id,v_email,new.title,new.body,
        '<div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;padding:24px;color:#101214">'
        ||'<h2 style="margin-bottom:12px">MediCrew</h2><h3>'
        ||replace(replace(new.title,'&','&amp;'),'<','&lt;')
        ||'</h3><p style="line-height:1.6">'
        ||replace(replace(replace(new.body,'&','&amp;'),'<','&lt;'),E'\\n','<br>')
        ||'</p><p style="color:#6F7672;font-size:12px">This is a transactional MediCrew message.</p></div>');
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.enqueue_transactional_email() from public;
drop trigger if exists notifications_enqueue_email on public.notifications;
create trigger notifications_enqueue_email after insert on public.notifications for each row execute function public.enqueue_transactional_email();

-- Ensure mission start is impossible until the company has actually paid through MediCrew.
create or replace function public.advance_mission_status(p_mission_id uuid,p_next_status public.mission_status)
returns public.mission_status language plpgsql security definer set search_path=public as $$
declare
  v_company_id uuid;
  v_assigned uuid;
  v_current public.mission_status;
  v_payment public.mission_payment_status;
begin
  select company_id,status into v_company_id,v_current from public.missions where id=p_mission_id for update;
  if v_company_id is null then raise exception 'Mission not found'; end if;
  select professional_id into v_assigned from public.mission_assignments where mission_id=p_mission_id;
  if auth.uid()<>v_company_id and auth.uid()<>v_assigned then raise exception 'Not authorized for this mission'; end if;
  if p_next_status='in_progress' then
    if v_current<>'confirmed' then raise exception 'Only confirmed missions can start'; end if;
    select status into v_payment from public.mission_payments where mission_id=p_mission_id;
    if v_payment is distinct from 'paid' then raise exception 'Payment required: the company must pay this mission through MediCrew before it can start'; end if;
  elsif p_next_status='cancelled' then
    if v_current in ('completed','cancelled') then raise exception 'Mission can no longer be cancelled'; end if;
    if v_current='in_progress' then raise exception 'In-progress missions are locked and cannot be cancelled'; end if;
  elsif p_next_status='completed' then
    raise exception 'Use confirm_mission_completion; both parties must confirm';
  else raise exception 'Unsupported status transition'; end if;
  update public.missions set status=p_next_status,updated_at=now() where id=p_mission_id;
  if v_assigned is not null then
    insert into public.notifications(profile_id,title,body,type,data) values
      (case when auth.uid()=v_company_id then v_assigned else v_company_id end,
       case p_next_status when 'in_progress' then 'Mission started' else 'Mission cancelled' end,
       case p_next_status when 'in_progress' then 'The MediCrew mission is now in progress.' else 'The MediCrew mission has been cancelled.' end,
       'mission_status',jsonb_build_object('mission_id',p_mission_id,'status',p_next_status,'email',true));
  end if;
  return p_next_status;
end;
$$;
revoke all on function public.advance_mission_status(uuid,public.mission_status) from public;
grant execute on function public.advance_mission_status(uuid,public.mission_status) to authenticated;

-- Payment records must be visible to the assigned professional, but remain immutable to clients.
alter table public.mission_payments add column if not exists professional_id uuid references public.professionals(id) on delete restrict;
create index if not exists mission_payments_professional_idx on public.mission_payments(professional_id,created_at desc);
drop policy if exists mission_payments_professional_read on public.mission_payments;
create policy mission_payments_professional_read on public.mission_payments for select to authenticated using(professional_id=auth.uid());

-- Mark the key confirmation/payment notifications as transactional email candidates.
comment on table public.notification_email_queue is 'Transactional email queue. Only notifications with data.email=true are sent.';
