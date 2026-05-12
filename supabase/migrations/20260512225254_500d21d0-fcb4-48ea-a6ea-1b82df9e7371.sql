-- 1) Force authenticated members to read portals through the sanitized portals_public view
DROP POLICY IF EXISTS "Members can view published portals" ON public.portals;

-- Switch portals_public to SECURITY DEFINER so it can be read without granting
-- broad SELECT on the underlying portals table. The view already filters
-- published = true and sanitizes telegram_config, exposing only safe columns.
ALTER VIEW public.portals_public SET (security_invoker = false);
GRANT SELECT ON public.portals_public TO anon, authenticated;

-- 2) Tighten app_settings public read to a known-safe key whitelist for anon
DROP POLICY IF EXISTS "app_settings public read" ON public.app_settings;

CREATE POLICY "app_settings authenticated read"
  ON public.app_settings
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "app_settings anon whitelist read"
  ON public.app_settings
  FOR SELECT
  TO anon
  USING (key IN (
    'signup_bonus_credits',
    'hub_create_costs',
    'vip_promo_banner_enabled',
    'power.coin_frozen'
  ));