-- Replace overly-permissive authenticated SELECT on app_settings with a whitelist
DROP POLICY IF EXISTS "app_settings authenticated read" ON public.app_settings;

CREATE POLICY "app_settings authenticated whitelist read"
ON public.app_settings
FOR SELECT
TO authenticated
USING (
  key = ANY (ARRAY[
    'signup_bonus_credits',
    'hub_create_costs',
    'vip_promo_banner_enabled',
    'power.coin_frozen'
  ])
  OR public.is_boss(auth.uid())
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);
