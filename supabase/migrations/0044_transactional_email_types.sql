create or replace function public.enqueue_transactional_email()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_email text;
begin
  if coalesce((new.data->>'email')::boolean,false)
     or new.type in ('mission_confirmed','professional_selected','mission_status','event_match','payment_paid','payment_failed','payment_refunded') then
    select email into v_email from public.profiles where id=new.profile_id;
    if coalesce(trim(v_email),'')<>'' then
      insert into public.notification_email_queue(profile_id,recipient_email,subject,body_text,body_html)
      values(new.profile_id,v_email,new.title,new.body,
        '<div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;padding:24px;color:#101214">'
        ||'<h2>MediCrew</h2><h3>'
        ||replace(replace(new.title,'&','&amp;'),'<','&lt;')
        ||'</h3><p style="line-height:1.6">'
        ||replace(replace(replace(new.body,'&','&amp;'),'<','&lt;'),E'\\n','<br>')
        ||'</p><p style="color:#6F7672;font-size:12px">Transactional MediCrew notification.</p></div>');
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.enqueue_transactional_email() from public;
grant execute on function public.enqueue_transactional_email() to authenticated;

