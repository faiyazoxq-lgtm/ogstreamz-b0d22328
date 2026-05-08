-- 1. trade_scans table
CREATE TABLE IF NOT EXISTS public.trade_scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  portal_slug text NOT NULL,
  asset_class text,
  signal text,
  confidence integer,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  delayed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS trade_scans_user_day_idx ON public.trade_scans (user_id, created_at DESC);

ALTER TABLE public.trade_scans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view own scans" ON public.trade_scans
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view all scans" ON public.trade_scans
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 2. RPC: enforce daily limit then insert
CREATE OR REPLACE FUNCTION public.apply_trade_scan(
  _portal_slug text,
  _asset_class text,
  _signal text,
  _confidence integer,
  _payload jsonb,
  _delayed boolean
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  is_vip boolean;
  used_today int;
  daily_limit int := 3;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT (status = 'vip') INTO is_vip FROM public.profiles WHERE id = uid;

  IF NOT is_vip THEN
    SELECT count(*) INTO used_today FROM public.trade_scans
      WHERE user_id = uid AND created_at >= (now() - interval '24 hours');
    IF used_today >= daily_limit THEN
      RAISE EXCEPTION 'Daily scan limit reached (% of %). Upgrade to VIP for unlimited.', used_today, daily_limit
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  INSERT INTO public.trade_scans (user_id, portal_slug, asset_class, signal, confidence, payload, delayed)
    VALUES (uid, _portal_slug, _asset_class, _signal, _confidence, COALESCE(_payload,'{}'::jsonb), _delayed);

  RETURN jsonb_build_object(
    'is_vip', is_vip,
    'used_today', CASE WHEN is_vip THEN 0 ELSE used_today + 1 END,
    'daily_limit', CASE WHEN is_vip THEN -1 ELSE daily_limit END
  );
END;
$$;

-- 3. Gallery view: include 'trade' kind with /td/{slug}
CREATE OR REPLACE VIEW public.syndicate_gallery
WITH (security_invoker = on) AS
SELECT p.id, p.slug, p.name,
  COALESCE(p.kind,'joke') AS kind,
  p.niche AS description,
  p.language, p.vibe, p.theme, p.theme_config, p.vip, p.created_at,
  CASE
    WHEN COALESCE(p.kind,'joke') = 'music' THEN '/m/' || p.slug
    WHEN COALESCE(p.kind,'joke') = 'trade' THEN '/td/' || p.slug
    ELSE '/p/' || p.slug
  END AS path,
  CASE
    WHEN COALESCE(p.kind,'joke') = 'music' THEN 'music'
    WHEN COALESCE(p.kind,'joke') = 'trade' THEN 'trade'
    ELSE 'joke'
  END AS category
FROM public.portals p
UNION ALL
SELECT c.id, c.slug, c.name,
  'tool' AS kind,
  c.description,
  NULL::text, NULL::text, NULL::text,
  c.config AS theme_config,
  c.vip, c.created_at,
  '/t/' || c.slug AS path,
  'tool' AS category
FROM public.calculators c
WHERE c.published = true;