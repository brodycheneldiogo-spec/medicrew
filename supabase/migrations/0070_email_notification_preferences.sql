-- Business/transactional email preference. Auth/security emails are handled by Supabase Auth and are not affected.
alter table public.profiles add column if not exists email_notifications_enabled boolean not null default true;

grant select, update on public.profiles to authenticated;

-- Queue every notification explicitly marked email=true, plus core operational events,
-- only when the recipient has MediCrew business emails enabled.
create or replace function public.enqueue_transactional_email()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_email text;
  v_enabled boolean;
  v_should_email boolean;
begin
  v_should_email := coalesce((new.data->>'email')::boolean,false)
    or new.type in (
      'verification_submitted','professional_verification','company_verification','company_document_verification',
      'mission_confirmed','professional_selected','mission_status','application_status','application_received',
      'event_match','mission_match','payment_paid','payment_failed','payment_refunded','payment_released',
      'mission_completed','mission_cancelled'
    );

  if not v_should_email then return new; end if;

  select email,email_notifications_enabled into v_email,v_enabled
  from public.profiles where id=new.profile_id;

  if coalesce(v_enabled,true) and coalesce(trim(v_email),'')<>'' then
    insert into public.notification_email_queue(profile_id,recipient_email,subject,body_text,body_html)
    values(
      new.profile_id,
      v_email,
      new.title,
      new.body,
      '<div style="background:#F4F7F5;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;color:#14231C">'
      ||'<div style="max-width:560px;margin:auto;background:#FFFFFF;border:1px solid #E3EAE6;border-radius:20px;padding:30px">'
      ||'<div style="font-size:22px;font-weight:900;margin-bottom:24px">MediCrew</div>'
      ||'<h2 style="font-size:24px;line-height:1.25;margin:0 0 12px">'
      ||replace(replace(new.title,'&','&amp;'),'<','&lt;')
      ||'</h2><p style="font-size:14px;line-height:1.65;color:#68756E;margin:0">'
      ||replace(replace(replace(new.body,'&','&amp;'),'<','&lt;'),E'\n','<br>')
      ||'</p><div style="height:1px;background:#E7ECE9;margin:28px 0 18px"></div>'
      ||'<p style="font-size:11px;line-height:17px;color:#9AA39F;margin:0">You can manage MediCrew business emails in Settings. Security and account recovery emails remain enabled.</p>'
      ||'</div></div>'
    );
  end if;
  return new;
end;
$$;
revoke all on function public.enqueue_transactional_email() from public;

drop trigger if exists notifications_enqueue_email on public.notifications;
create trigger notifications_enqueue_email
after insert on public.notifications
for each row execute function public.enqueue_transactional_email();

