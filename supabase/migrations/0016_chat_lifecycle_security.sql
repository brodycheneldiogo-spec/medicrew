-- Harden mission chat access and lifecycle.
-- Chat remains available only to the two assigned mission participants.
create or replace function public.send_mission_message(p_mission_id uuid,p_body text)
returns uuid language plpgsql security definer set search_path=public
as $$
declare v_conversation uuid; v_message uuid; v_recipient uuid; v_status public.mission_status; v_clean text:=trim(coalesce(p_body,''));
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if length(v_clean)=0 then raise exception 'Message cannot be empty'; end if;
 if length(v_clean)>4000 then raise exception 'Message is too long'; end if;
 select status into v_status from public.missions where id=p_mission_id;
 if v_status is null then raise exception 'Mission not found'; end if;
 if v_status not in ('confirmed','in_progress') then raise exception 'Mission chat is closed'; end if;
 select c.id into v_conversation from public.conversations c join public.conversation_members cm on cm.conversation_id=c.id where c.mission_id=p_mission_id and cm.profile_id=auth.uid();
 if v_conversation is null then raise exception 'You are not a member of this mission chat'; end if;
 select profile_id into v_recipient from public.conversation_members where conversation_id=v_conversation and profile_id<>auth.uid() limit 1;
 insert into public.messages(conversation_id,sender_id,body) values(v_conversation,auth.uid(),v_clean) returning id into v_message;
 if v_recipient is not null then insert into public.notifications(profile_id,title,body,type,data) values(v_recipient,'New mission message',left(v_clean,140),'message',jsonb_build_object('mission_id',p_mission_id,'conversation_id',v_conversation)); end if;
 return v_message;
end; $$;
grant execute on function public.send_mission_message(uuid,text) to authenticated;

create or replace function public.mark_conversation_read(p_conversation_id uuid)
returns void language plpgsql security definer set search_path=public
as $$
declare v_mission uuid; v_status public.mission_status;
begin
 select c.mission_id into v_mission from public.conversations c join public.conversation_members cm on cm.conversation_id=c.id where c.id=p_conversation_id and cm.profile_id=auth.uid();
 if v_mission is null then raise exception 'Not a conversation member'; end if;
 select status into v_status from public.missions where id=v_mission;
 if v_status not in ('confirmed','in_progress','completed','cancelled') then raise exception 'Conversation unavailable'; end if;
 update public.messages set read_at=now() where conversation_id=p_conversation_id and sender_id<>auth.uid() and read_at is null;
end; $$;
grant execute on function public.mark_conversation_read(uuid) to authenticated;
