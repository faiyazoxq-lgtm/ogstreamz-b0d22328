-- Portal download ledger
CREATE TABLE IF NOT EXISTS public.portal_downloads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  portal_id uuid NOT NULL,
  mode text NOT NULL CHECK (mode IN ('vip_free','paid')),
  credits_spent integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS portal_downloads_user_portal_day_idx
  ON public.portal_downloads (user_id, portal_id, ((created_at AT TIME ZONE 'UTC')::date));
CREATE INDEX IF NOT EXISTS portal_downloads_user_idx
  ON public.portal_downloads (user_id, created_at DESC);

ALTER TABLE public.portal_downloads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read own downloads" ON public.portal_downloads
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Boss reads all downloads" ON public.portal_downloads
  FOR SELECT TO authenticated
  USING (public.is_boss(auth.uid()) OR public.has_role(auth.uid(),'admin'::app_role));

-- Peek: report status without charging
CREATE OR REPLACE FUNCTION public.peek_portal_download(_portal_id uuid, _cost integer DEFAULT 2)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  is_og boolean;
  used_today int;
  bal int;
  cost int := GREATEST(1, COALESCE(_cost, 2));
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _portal_id IS NULL THEN RAISE EXCEPTION 'Portal required'; END IF;

  SELECT credits INTO bal FROM public.profiles WHERE id = uid;
  is_og := public.is_real_og(uid);

  SELECT count(*) INTO used_today FROM public.portal_downloads
   WHERE user_id = uid AND portal_id = _portal_id
     AND mode = 'vip_free'
     AND (created_at AT TIME ZONE 'UTC')::date = (now() AT TIME ZONE 'UTC')::date;

  RETURN jsonb_build_object(
    'cost', cost,
    'balance', COALESCE(bal, 0),
    'is_real_og', is_og,
    'vip_free_used_today', used_today,
    'vip_free_available', (is_og AND used_today = 0),
    'can_pay', COALESCE(bal,0) >= cost
  );
END $$;

-- Claim: either use vip free pass OR spend credits, then log
CREATE OR REPLACE FUNCTION public.claim_portal_download(_portal_id uuid, _cost integer DEFAULT 2)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  is_og boolean;
  used_today int;
  bal int;
  new_balance int;
  cost int := GREATEST(1, COALESCE(_cost, 2));
  use_vip boolean := false;
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

  RETURN jsonb_build_object(
    'ok', true, 'mode', 'paid',
    'balance', new_balance, 'cost', cost,
    'vip_free_used_today', COALESCE(used_today, 0)
  );
END $$;