-- 1. tracks: column-level revoke for full_path & suno_prompt (RLS can't do columns)
REVOKE SELECT (full_path, suno_prompt) ON public.tracks FROM authenticated, anon;

-- 2. analytics_settings: replace open authenticated read with boss/admin only
DROP POLICY IF EXISTS "Authenticated read analytics settings" ON public.analytics_settings;
CREATE POLICY "Boss/admin read analytics settings"
  ON public.analytics_settings FOR SELECT
  TO authenticated
  USING (public.is_boss(auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role));

-- 3. hub_settings: replace USING (true) with boss/admin only
DROP POLICY IF EXISTS "Hub settings readable by authenticated" ON public.hub_settings;
CREATE POLICY "Boss/admin read hub settings"
  ON public.hub_settings FOR SELECT
  TO authenticated
  USING (public.is_boss(auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role));

-- 4. bot_configs: drop broad active read; admins keep "Admins read all bots"
DROP POLICY IF EXISTS "Authenticated read active bots" ON public.bot_configs;

-- 5. Realtime: remove admin-only tables from the publication so authenticated
--    users cannot subscribe to postgres_changes for them.
ALTER PUBLICATION supabase_realtime DROP TABLE public.ai_logs;
ALTER PUBLICATION supabase_realtime DROP TABLE public.boss_todos;
ALTER PUBLICATION supabase_realtime DROP TABLE public.system_alerts;
ALTER PUBLICATION supabase_realtime DROP TABLE public.payments_settings;