-- Notification center: safe read/unread operations and per-user access.
create or replace function public.mark_notification_read(p_notification_id uuid)
returns void language plpgsql security definer set search_path=public
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  update public.notifications set read_at=coalesce(read_at,now()) where id=p_notification_id and profile_id=auth.uid();
end; $$;
grant execute on function public.mark_notification_read(uuid) to authenticated;

create or replace function public.mark_all_notifications_read()
returns void language plpgsql security definer set search_path=public
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  update public.notifications set read_at=now() where profile_id=auth.uid() and read_at is null;
end; $$;
grant execute on function public.mark_all_notifications_read() to authenticated;

create or replace function public.get_my_notifications(p_limit integer default 50)
returns table(id uuid,title text,body text,type text,data jsonb,read_at timestamptz,created_at timestamptz)
language sql security definer set search_path=public
as $$
  select n.id,n.title,n.body,n.type,n.data,n.read_at,n.created_at
  from public.notifications n
  where n.profile_id=auth.uid()
  order by n.created_at desc
  limit greatest(1,least(coalesce(p_limit,50),100));
$$;
grant execute on function public.get_my_notifications(integer) to authenticated;

-- Defense in depth: direct table access is limited to the owner of the notification.
alter table public.notifications enable row level security;
drop policy if exists notifications_select_own on public.notifications;
drop policy if exists notifications_update_own on public.notifications;
create policy notifications_select_own on public.notifications for select to authenticated using (profile_id=auth.uid());
create policy notifications_update_own on public.notifications for update to authenticated using (profile_id=auth.uid()) with check (profile_id=auth.uid());

