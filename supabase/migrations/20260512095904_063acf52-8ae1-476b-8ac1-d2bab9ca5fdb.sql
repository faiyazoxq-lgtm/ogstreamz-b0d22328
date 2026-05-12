-- Restrict paid_services from anonymous reads. This column carries operator-only
-- billing/cost configuration and is only consumed by boss admin routes
-- (boss.portals, boss.hubs). Authenticated users keep access since the boss
-- admin UI runs as authenticated via RLS.
REVOKE SELECT (paid_services) ON public.portals FROM anon;