
-- 1. Royalty ledger
CREATE TABLE IF NOT EXISTS public.portal_royalty_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_id uuid NOT NULL,
  creator_id uuid NOT NULL,
  payer_id uuid NOT NULL,
  source text NOT NULL,
  gross_credits int NOT NULL,
  royalty_credits int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.portal_royalty_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Creators view own royalties" ON public.portal_royalty_ledger;
CREATE POLICY "Creators view own royalties" ON public.portal_royalty_ledger
  FOR SELECT TO authenticated USING (auth.uid() = creator_id);

DROP POLICY IF EXISTS "Boss reads all royalties" ON public.portal_royalty_ledger;
CREATE POLICY "Boss reads all royalties" ON public.portal_royalty_ledger
  FOR SELECT TO authenticated USING (public.is_boss(auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE INDEX IF NOT EXISTS idx_portal_royalty_creator ON public.portal_royalty_ledger(creator_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_portal_royalty_portal  ON public.portal_royalty_ledger(portal_id, created_at DESC);

-- 2. Nav portal listing function
CREATE OR REPLACE FUNCTION public.list_nav_portals()
RETURNS TABLE(id uuid, slug text, name text, vip boolean, by_boss boolean, paid boolean, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT
    p.id, p.slug, p.name, p.vip,
    (p.created_by IS NULL
      OR public.is_boss(p.created_by)
      OR public.has_role(p.created_by, 'admin'::public.app_role)) AS by_boss,
    (COALESCE(p.price_cents,0) > 0 OR COALESCE(p.use_credit_cost,0) > 0) AS paid,
    p.created_at
  FROM public.portals p
  WHERE
    (p.created_by IS NULL
      OR public.is_boss(p.created_by)
      OR public.has_role(p.created_by, 'admin'::public.app_role))
    OR (p.created_by IS NOT NULL
        AND (COALESCE(p.price_cents,0) > 0 OR COALESCE(p.use_credit_cost,0) > 0))
  ORDER BY p.created_at DESC
  LIMIT 100;
$$;
GRANT EXECUTE ON FUNCTION public.list_nav_portals() TO anon, authenticated;

-- 3. Royalty payout on paid portal downloads
CREATE OR REPLACE FUNCTION public.claim_portal_download(_portal_id uuid, _cost integer DEFAULT 2)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  is_og boolean;
  used_today int;
  bal int;
  new_balance int;
  cost int := GREATEST(1, COALESCE(_cost, 2));
  use_vip boolean := false;
  creator uuid;
  royalty int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _portal_id IS NULL THEN RAISE EXCEPTION 'Portal required'; END IF;

  SELECT credits INTO bal FROM public.profiles WHERE id = uid FOR UPDATE;
  is_og := public.is_real_og(uid);

  IF is_og THEN
    SELECT count(*) INTO used_today FROM public.portal_downloads
     WHERE user_id = uid AND portal_id = _portal_id
       AND mode = 'vip_free'
       AND (created_at AT TIME ZONE 'UTC')::date = (now() AT TIME ZONE 'UTC')::date;
    IF used_today = 0 THEN use_vip := true; END IF;
  END IF;

  IF use_vip THEN
    INSERT INTO public.portal_downloads (user_id, portal_id, mode, credits_spent)
      VALUES (uid, _portal_id, 'vip_free', 0);
    RETURN jsonb_build_object(
      'ok', true, 'mode', 'vip_free',
      'balance', COALESCE(bal,0), 'cost', 0,
      'vip_free_used_today', 1
    );
  END IF;

  IF COALESCE(bal,0) < cost THEN
    RAISE EXCEPTION 'Insufficient credits' USING ERRCODE = 'P0001';
  END IF;

  new_balance := bal - cost;
  UPDATE public.profiles SET credits = new_balance, updated_at = now() WHERE id = uid;
  INSERT INTO public.credit_ledger (user_id, delta, reason)
    VALUES (uid, -cost, 'portal_download:' || _portal_id::text);
  INSERT INTO public.portal_downloads (user_id, portal_id, mode, credits_spent)
    VALUES (uid, _portal_id, 'paid', cost);

  -- Creator royalty (30%) when portal owner is a member (not boss/admin) and not the same user
  SELECT created_by INTO creator FROM public.portals WHERE id = _portal_id;
  IF creator IS NOT NULL AND creator <> uid
     AND NOT public.is_boss(creator)
     AND NOT public.has_role(creator, 'admin'::public.app_role) THEN
    royalty := GREATEST(1, (cost * 30) / 100);
    UPDATE public.profiles SET credits = credits + royalty, updated_at = now() WHERE id = creator;
    INSERT INTO public.credit_ledger (user_id, delta, reason)
      VALUES (creator, royalty, 'royalty:portal_download:' || _portal_id::text);
    INSERT INTO public.portal_royalty_ledger (portal_id, creator_id, payer_id, source, gross_credits, royalty_credits)
      VALUES (_portal_id, creator, uid, 'portal_download', cost, royalty);
  END IF;

  RETURN jsonb_build_object(
    'ok', true, 'mode', 'paid',
    'balance', new_balance, 'cost', cost,
    'vip_free_used_today', COALESCE(used_today, 0)
  );
END $function$;
