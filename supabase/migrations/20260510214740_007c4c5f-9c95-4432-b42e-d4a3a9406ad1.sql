-- 1. Per-hub create cost on custom_hubs
ALTER TABLE public.custom_hubs
  ADD COLUMN IF NOT EXISTS create_portal_cost integer NOT NULL DEFAULT 1
    CHECK (create_portal_cost >= 0);

-- 2. Per-portal use cost on portals (0 = free)
ALTER TABLE public.portals
  ADD COLUMN IF NOT EXISTS use_credit_cost integer NOT NULL DEFAULT 0
    CHECK (use_credit_cost >= 0);

-- 3. Built-in hub create costs in app_settings
INSERT INTO public.app_settings (key, value, updated_at)
VALUES (
  'hub_create_costs',
  jsonb_build_object(
    'music', 1, 'jokes', 1, 'trade', 1,
    'connect', 1, 'battle', 1, 'tools', 1
  ),
  now()
)
ON CONFLICT (key) DO NOTHING;

-- 4. RPC to charge a user when they actively use a portal
CREATE OR REPLACE FUNCTION public.charge_portal_use(_portal_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  cost integer;
  slug_txt text;
  bal integer;
  is_vip boolean;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT use_credit_cost, slug INTO cost, slug_txt
    FROM public.portals WHERE id = _portal_id;
  IF cost IS NULL THEN
    RAISE EXCEPTION 'Portal not found';
  END IF;
  IF cost <= 0 THEN
    SELECT credits INTO bal FROM public.profiles WHERE id = uid;
    RETURN COALESCE(bal, 0);
  END IF;

  SELECT credits, status = 'vip' INTO bal, is_vip
    FROM public.profiles WHERE id = uid FOR UPDATE;

  -- VIP free pass for tiny spends, mirrors spend_credits()
  IF is_vip AND cost <= 5 THEN
    INSERT INTO public.credit_ledger (user_id, delta, reason)
      VALUES (uid, 0, 'use_portal:' || COALESCE(slug_txt, _portal_id::text) || ' (vip)');
    RETURN bal;
  END IF;

  IF bal < cost THEN
    RAISE EXCEPTION 'Insufficient credits' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.profiles
    SET credits = credits - cost, updated_at = now()
    WHERE id = uid
    RETURNING credits INTO bal;

  INSERT INTO public.credit_ledger (user_id, delta, reason)
    VALUES (uid, -cost, 'use_portal:' || COALESCE(slug_txt, _portal_id::text));

  RETURN bal;
END $$;

REVOKE ALL ON FUNCTION public.charge_portal_use(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.charge_portal_use(uuid) TO authenticated;