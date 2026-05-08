
-- ───────── Phase 1: power_packs ─────────
CREATE TABLE public.power_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  asset text NOT NULL,
  bias text NOT NULL DEFAULT 'neutral',
  command text NOT NULL,
  summary text,
  bull_case text,
  bear_case text,
  headlines jsonb NOT NULL DEFAULT '[]'::jsonb,
  citations jsonb NOT NULL DEFAULT '[]'::jsonb,
  anthem_prompt text,
  video_prompt text,
  telegram_caption text,
  video_url text,
  suno_task_id text,
  suno_audio_url text,
  telegram_message_id text,
  telegram_status text NOT NULL DEFAULT 'pending',
  status text NOT NULL DEFAULT 'scouting',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.power_packs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view own power packs"
ON public.power_packs FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins manage power packs"
ON public.power_packs FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_power_packs_updated
BEFORE UPDATE ON public.power_packs
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.power_packs;
ALTER TABLE public.power_packs REPLICA IDENTITY FULL;

-- chain suno jobs to power packs
ALTER TABLE public.suno_jobs ADD COLUMN power_pack_id uuid;
CREATE INDEX idx_suno_jobs_power_pack ON public.suno_jobs(power_pack_id) WHERE power_pack_id IS NOT NULL;

-- ───────── Phase 3: market_pulse ─────────
CREATE TABLE public.market_pulse (
  asset text PRIMARY KEY,
  price numeric,
  prev_price numeric,
  delta_pct numeric,
  direction text NOT NULL DEFAULT 'flat',
  source text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.market_pulse ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read pulse"
ON public.market_pulse FOR SELECT TO public
USING (true);

CREATE POLICY "Admins write pulse"
ON public.market_pulse FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

ALTER PUBLICATION supabase_realtime ADD TABLE public.market_pulse;
ALTER TABLE public.market_pulse REPLICA IDENTITY FULL;

-- seed Gold flat
INSERT INTO public.market_pulse (asset, price, direction) VALUES ('XAU', 4760, 'flat')
ON CONFLICT (asset) DO NOTHING;

-- ───────── Phase 4: card_waitlist ─────────
CREATE TABLE public.card_waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email text NOT NULL,
  tier text NOT NULL DEFAULT 'standard',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE public.card_waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view own waitlist row"
ON public.card_waitlist FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Members insert own waitlist row"
ON public.card_waitlist FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins manage waitlist"
ON public.card_waitlist FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ───────── Phase 5: SEO fields on portals ─────────
ALTER TABLE public.portals
  ADD COLUMN seo_title text,
  ADD COLUMN seo_description text,
  ADD COLUMN seo_image_url text,
  ADD COLUMN seo_refreshed_at timestamptz;
