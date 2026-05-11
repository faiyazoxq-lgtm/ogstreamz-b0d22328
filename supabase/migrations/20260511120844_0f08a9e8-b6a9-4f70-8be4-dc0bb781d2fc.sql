-- Lock down domain_denylist: only boss/admin can read rows.
-- Provide a safe public RPC that returns just the domain strings,
-- which is all the client SafeLink/SafeImage needs.
DROP POLICY IF EXISTS "Public reads denylist" ON public.domain_denylist;

CREATE OR REPLACE FUNCTION public.get_domain_denylist()
RETURNS TABLE (domain text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT d.domain FROM public.domain_denylist d ORDER BY d.domain;
$$;

REVOKE ALL ON FUNCTION public.get_domain_denylist() FROM public;
GRANT EXECUTE ON FUNCTION public.get_domain_denylist() TO anon, authenticated;

-- Lock down fleet_settings: only boss/admin can read.
DROP POLICY IF EXISTS "Anyone can read fleet settings" ON public.fleet_settings;

CREATE POLICY "Boss/admin reads fleet settings"
  ON public.fleet_settings
  FOR SELECT
  TO authenticated
  USING (is_boss(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));
