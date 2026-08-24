-- Queue push deliveries from the existing notifications table.
-- Configure a Supabase Database Webhook for INSERT on this table -> send-push-notification.
create table if not exists public.notification_push_queue(id uuid primary key default gen_random_uuid(),profile_id uuid not null references public.profiles(id) on delete cascade,title text not null,body text not null,data jsonb not null default '{}'::jsonb,created_at timestamptz not null default now(),delivered_at timestamptz);
create index if not exists notification_push_queue_pending_idx on public.notification_push_queue(created_at) where delivered_at is null;
alter table public.notification_push_queue enable row level security;
create or replace function public.enqueue_push_for_notification() returns trigger language plpgsql security definer set search_path=public as $$ begin insert into public.notification_push_queue(profile_id,title,body,data) values(new.profile_id,new.title,new.body,coalesce(new.data,'{}'::jsonb));return new;end; $$;
drop trigger if exists notification_push_queue_trigger on public.notifications;
create trigger notification_push_queue_trigger after insert on public.notifications for each row execute function public.enqueue_push_for_notification();

