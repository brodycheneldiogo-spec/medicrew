-- Company-owned mission writes remain restricted by the existing missions RLS policies.
grant insert, delete on table public.missions to authenticated;
