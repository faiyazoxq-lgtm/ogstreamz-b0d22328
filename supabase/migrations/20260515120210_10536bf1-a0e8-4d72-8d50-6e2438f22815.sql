-- Restrict swear_lexicon SELECT to boss/admin only.
-- Server-side callers that need to read it for chat enforcement must use the
-- service-role client (supabaseAdmin) which bypasses RLS.
DROP POLICY IF EXISTS "Authenticated read swear lexicon" ON public.swear_lexicon;
DROP POLICY IF EXISTS "Public read swear lexicon" ON public.swear_lexicon;

CREATE POLICY "Boss and admin read swear lexicon"
  ON public.swear_lexicon
  FOR SELECT
  TO authenticated
  USING (is_boss(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

-- Restrict civility_settings SELECT to boss/admin only.
-- The default value used by table defaults is sourced via the SECURITY DEFINER
-- function civility_default(), which bypasses RLS, so non-boss flows are not
-- affected.
DROP POLICY IF EXISTS "Authenticated read civility" ON public.civility_settings;

CREATE POLICY "Boss and admin read civility"
  ON public.civility_settings
  FOR SELECT
  TO authenticated
  USING (is_boss(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));