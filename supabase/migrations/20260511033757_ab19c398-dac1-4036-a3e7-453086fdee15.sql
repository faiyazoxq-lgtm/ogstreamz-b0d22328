-- portal_brief_versions: drop public read; existing boss/admin ALL policy still grants read to staff
DROP POLICY IF EXISTS "Anyone can view brief versions" ON public.portal_brief_versions;

-- ai_logs: remove the authenticated-insert policy. service_role (used by edge
-- functions) bypasses RLS so server-side writes continue to work, but
-- regular signed-in clients can no longer forge log entries.
DROP POLICY IF EXISTS "Authenticated insert own ai logs" ON public.ai_logs;