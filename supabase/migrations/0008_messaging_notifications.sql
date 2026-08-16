-- Mission-scoped messaging and notification helpers.
create or replace function public.get_my_conversations()
returns table (
  conversation_id uuid,
  mission_id uuid,
  mission_title text,
  other_profile_id uuid,
  other_first_name text,
  other_last_name text,
  last_message text,
  last_message_at timestamptz,
  unread_count bigint
)
language sql
security definer
set search_path = public
as $$
  select c.id,
         c.mission_id,
         m.title,
         other_p.id,
         other_p.first_name,
         other_p.last_name,
         lm.body,
         lm.created_at,
         coalesce((select count(*) from public.messages um where um.conversation_id=c.id and um.sender_id <> auth.uid() and um.read_at is null),0)
  from public.conversations c
  join public.missions m on m.id=c.mission_id
  join public.conversation_members mine on mine.conversation_id=c.id and mine.profile_id=auth.uid()
  left join lateral (
    select p.* from public.conversation_members cm join public.profiles p on p.id=cm.profile_id
    where cm.conversation_id=c.id and cm.profile_id <> auth.uid() limit 1
  ) other_p on true
  left join lateral (select body,created_at from public.messages where conversation_id=c.id order by created_at desc limit 1) lm on true
  order by lm.created_at desc nulls last;
$$;

grant execute on function public.get_my_conversations() to authenticated;

create or replace function public.send_mission_message(p_mission_id uuid, p_body text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conversation uuid;
  v_message uuid;
  v_recipient uuid;
  v_clean text := trim(coalesce(p_body,''));
begin
  if length(v_clean)=0 then raise exception 'Message cannot be empty'; end if;
  if length(v_clean)>4000 then raise exception 'Message is too long'; end if;

  select c.id into v_conversation
  from public.conversations c
  join public.conversation_members cm on cm.conversation_id=c.id
  where c.mission_id=p_mission_id and cm.profile_id=auth.uid();
  if v_conversation is null then raise exception 'You are not a member of this mission chat'; end if;

  select profile_id into v_recipient from public.conversation_members
  where conversation_id=v_conversation and profile_id<>auth.uid() limit 1;

  insert into public.messages(conversation_id,sender_id,body)
  values(v_conversation,auth.uid(),v_clean) returning id into v_message;

  if v_recipient is not null then
    insert into public.notifications(profile_id,title,body,type,data)
    values(v_recipient,'New mission message',left(v_clean,140),'message',jsonb_build_object('mission_id',p_mission_id,'conversation_id',v_conversation));
  end if;
  return v_message;
end;
$$;

grant execute on function public.send_mission_message(uuid,text) to authenticated;

create or replace function public.mark_conversation_read(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.conversation_members where conversation_id=p_conversation_id and profile_id=auth.uid()) then
    raise exception 'Not a conversation member';
  end if;
  update public.messages set read_at=now() where conversation_id=p_conversation_id and sender_id<>auth.uid() and read_at is null;
end;
$$;

grant execute on function public.mark_conversation_read(uuid) to authenticated;

create policy "conversation members read conversations" on public.conversations for select using (exists (select 1 from public.conversation_members cm where cm.conversation_id=id and cm.profile_id=auth.uid()));
create policy "conversation members read members" on public.conversation_members for select using (profile_id=auth.uid() or exists (select 1 from public.conversation_members mine where mine.conversation_id=conversation_members.conversation_id and mine.profile_id=auth.uid()));
create policy "conversation members read messages" on public.messages for select using (exists (select 1 from public.conversation_members cm where cm.conversation_id=messages.conversation_id and cm.profile_id=auth.uid()));

-- Enable realtime delivery for mission chat and notifications.
do $$ begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then null; end $$;
