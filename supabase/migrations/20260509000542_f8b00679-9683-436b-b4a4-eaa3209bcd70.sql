-- Store packs table (boss-managed catalog)
CREATE TABLE IF NOT EXISTS public.store_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  price_id text UNIQUE NOT NULL,
  name text NOT NULL,
  tagline text NOT NULL DEFAULT '',
  amount_cents integer NOT NULL DEFAULT 0,
  credits integer,
  recurring boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.store_packs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read active packs" ON public.store_packs FOR SELECT TO public USING (active = true);
CREATE POLICY "Boss reads all packs" ON public.store_packs FOR SELECT TO authenticated USING (is_boss(auth.uid()));
CREATE POLICY "Boss manages packs" ON public.store_packs FOR ALL TO authenticated USING (is_boss(auth.uid())) WITH CHECK (is_boss(auth.uid()));

CREATE TRIGGER trg_store_packs_touch BEFORE UPDATE ON public.store_packs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Seed with existing static catalog
INSERT INTO public.store_packs (price_id, name, tagline, amount_cents, credits, recurring, sort_order) VALUES
  ('starter_pack_10',    'Starter Pack',  '10 Portal Credits',         499,  10,   false, 1),
  ('enforcer_pack_50',   'Enforcer Pack', '50 Portal Credits',         1999, 50,   false, 2),
  ('boss_pack_monthly',  'Boss Pack',     'Unlimited monthly VIP',     2999, NULL, true,  3)
ON CONFLICT (price_id) DO NOTHING;

-- Singleton settings (credits-per-song display unit)
CREATE TABLE IF NOT EXISTS public.store_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  credits_per_song integer NOT NULL DEFAULT 5,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public reads store settings" ON public.store_settings FOR SELECT TO public USING (true);
CREATE POLICY "Boss writes store settings" ON public.store_settings FOR ALL TO authenticated USING (is_boss(auth.uid())) WITH CHECK (is_boss(auth.uid()));

CREATE TRIGGER trg_store_settings_touch BEFORE UPDATE ON public.store_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.store_settings (id, credits_per_song) VALUES (1, 5)
ON CONFLICT (id) DO NOTHING;