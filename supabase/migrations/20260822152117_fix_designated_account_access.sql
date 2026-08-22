-- RLS policies call is_admin() for authenticated requests. Its PUBLIC grant was
-- intentionally removed in 0072, so authenticated needs this explicit grant.
-- The function only checks the current auth.uid() and does not grant a role.
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- Repair the exact owner-designated admin account if it was created before the
-- profile trigger, while leaving every other account unchanged.
update public.profiles p
set role = 'admin', email = lower(u.email), updated_at = now()
from auth.users u
where p.id = u.id
  and lower(u.email) = 'work.medicrew.app@gmail.com';
