create or replace function public.my_direct_conversations()
returns table(conversation_id uuid,other_profile_id uuid,display_name text,avatar_url text,role public.account_role,last_message text,last_message_at timestamptz)
language sql stable security definer set search_path=public as $$
 select c.id,other.profile_id,
   case when p.role='company' then co.company_name else trim(coalesce(p.first_name,'')||' '||coalesce(p.last_name,'')) end,
   p.avatar_url,p.role,
   (select dm.body from public.direct_messages dm where dm.conversation_id=c.id order by dm.created_at desc limit 1),
   (select dm.created_at from public.direct_messages dm where dm.conversation_id=c.id order by dm.created_at desc limit 1)
 from public.direct_conversations c
 join public.direct_conversation_members mine on mine.conversation_id=c.id and mine.profile_id=auth.uid()
 join public.direct_conversation_members other on other.conversation_id=c.id and other.profile_id<>auth.uid()
 join public.profiles p on p.id=other.profile_id
 left join public.companies co on co.id=p.id
 order by last_message_at desc nulls last,c.created_at desc;
$$;
revoke all on function public.my_direct_conversations() from public;
grant execute on function public.my_direct_conversations() to authenticated;

create or replace function public.mark_direct_conversation_read(p_conversation_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
 if not public.is_direct_conversation_member(p_conversation_id) then raise exception 'Conversation access denied'; end if;
 update public.direct_messages set read_at=coalesce(read_at,now()) where conversation_id=p_conversation_id and sender_id<>auth.uid();
end; $$;
revoke all on function public.mark_direct_conversation_read(uuid) from public;
grant execute on function public.mark_direct_conversation_read(uuid) to authenticated;
