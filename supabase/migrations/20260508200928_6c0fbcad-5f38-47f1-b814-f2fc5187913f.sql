
ALTER TABLE public.portals
  ADD COLUMN IF NOT EXISTS vip boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS theme_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS scout_meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS price_cents integer NOT NULL DEFAULT 500;

CREATE TABLE IF NOT EXISTS public.portal_unlocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  portal_id uuid NOT NULL,
  stripe_session_id text NOT NULL UNIQUE,
  amount_cents integer NOT NULL,
  currency text NOT NULL DEFAULT 'usd',
  environment text NOT NULL DEFAULT 'sandbox',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.portal_unlocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view own portal unlocks"
  ON public.portal_unlocks FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins view all portal unlocks"
  ON public.portal_unlocks FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_portal_unlocks_user ON public.portal_unlocks(user_id);
CREATE INDEX IF NOT EXISTS idx_portal_unlocks_portal ON public.portal_unlocks(portal_id);
