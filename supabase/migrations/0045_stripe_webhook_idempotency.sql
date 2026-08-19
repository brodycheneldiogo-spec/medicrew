create table if not exists public.stripe_webhook_events (
  event_id text primary key,
  event_type text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error_message text
);
revoke all on public.stripe_webhook_events from anon,authenticated;
