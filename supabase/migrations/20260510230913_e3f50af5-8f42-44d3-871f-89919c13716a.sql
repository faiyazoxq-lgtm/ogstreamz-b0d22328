-- =============================================================
-- Pricing / billing metadata model for every portal & hub action
-- =============================================================
-- Single source of truth for how each action is priced:
--   free            — always free, no charge
--   pay_per_use     — charge cost_credits per invocation
--   subscription    — gated by required_tier; no per-use charge
--   allowance       — N free uses per period for required_tier; pay_per_use beyond

CREATE TYPE public.billing_mode AS ENUM ('free','pay_per_use','subscription','allowance');
CREATE TYPE public.allowance_period AS ENUM ('day','week','month');
CREATE TYPE public.access_tier AS ENUM ('visitor','member','stream','vip','boss');

CREATE TABLE public.action_billing (
  action_key       text PRIMARY KEY,
  hub              text NOT NULL DEFAULT 'global',
  label            text NOT NULL,
  description      text,
  billing_mode     public.billing_mode NOT NULL DEFAULT 'free',
  cost_credits     integer NOT NULL DEFAULT 0 CHECK (cost_credits >= 0),
  required_tier    public.access_tier NOT NULL DEFAULT 'member',
  allowance_count  integer CHECK (allowance_count IS NULL OR allowance_count >= 0),
  allowance_period public.allowance_period,
  vip_free_eligible boolean NOT NULL DEFAULT false,
  active           boolean NOT NULL DEFAULT true,
  sort_order       integer NOT NULL DEFAULT 0,
  metadata         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  -- Mode-specific consistency:
  --   pay_per_use must have cost_credits > 0
  --   allowance must specify count + period AND a positive cost for overflow
  CONSTRAINT action_billing_mode_consistency CHECK (
    (billing_mode = 'free'        AND cost_credits = 0 AND allowance_count IS NULL AND allowance_period IS NULL)
    OR (billing_mode = 'pay_per_use'  AND cost_credits > 0 AND allowance_count IS NULL AND allowance_period IS NULL)
    OR (billing_mode = 'subscription' AND cost_credits = 0 AND allowance_count IS NULL AND allowance_period IS NULL)
    OR (billing_mode = 'allowance'    AND cost_credits >= 0 AND allowance_count IS NOT NULL AND allowance_period IS NOT NULL)
  )
);

CREATE INDEX action_billing_hub_idx       ON public.action_billing (hub, sort_order);
CREATE INDEX action_billing_active_idx    ON public.action_billing (active) WHERE active = true;

CREATE TRIGGER trg_action_billing_updated_at
  BEFORE UPDATE ON public.action_billing
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.action_billing ENABLE ROW LEVEL SECURITY;

-- Anyone signed in can read the billing catalogue (UI needs it for the cost
-- estimator, gating, paywall copy, etc.)
CREATE POLICY "Members can read billing catalogue"
  ON public.action_billing
  FOR SELECT
  TO authenticated
  USING (active = true OR public.is_boss(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));

-- Only Boss / admin can change billing rules.
CREATE POLICY "Boss can insert billing rules"
  ON public.action_billing
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_boss(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Boss can update billing rules"
  ON public.action_billing
  FOR UPDATE
  TO authenticated
  USING (public.is_boss(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.is_boss(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Boss can delete billing rules"
  ON public.action_billing
  FOR DELETE
  TO authenticated
  USING (public.is_boss(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));

-- ---------------------------------------------------------------
-- Seed the catalogue with the actions the app already gates on.
-- (Mirrors src/lib/action-gates.ts so UI + DB agree on day one.)
-- ---------------------------------------------------------------
INSERT INTO public.action_billing
  (action_key, hub, label, description, billing_mode, cost_credits, required_tier,
   allowance_count, allowance_period, vip_free_eligible, sort_order)
VALUES
  -- Hub spawns
  ('hub:music',   'music',   'Spawn music portal',   'Create a new MusicHUB studio',     'subscription', 0, 'vip',    NULL, NULL, false, 10),
  ('hub:jokes',   'jokes',   'Spawn jokes portal',   'Create a new JokesHUB portal',     'subscription', 0, 'vip',    NULL, NULL, false, 20),
  ('hub:tools',   'tools',   'Spawn tools portal',   'Create a new ToolHUB instance',    'subscription', 0, 'vip',    NULL, NULL, false, 30),
  ('hub:trade',   'trade',   'Spawn trade portal',   'Create a new TradeHUB scanner',    'pay_per_use',  1, 'stream', NULL, NULL, false, 40),
  ('hub:connect', 'connect', 'Spawn connect portal', 'Create a new ConnectHUB room',     'pay_per_use',  1, 'stream', NULL, NULL, false, 50),
  ('hub:battle',  'battle',  'Spawn battle portal',  'Create a new BattleHUB scenario',  'pay_per_use',  1, 'stream', NULL, NULL, false, 60),

  -- Coin-cost actions with VIP perks
  ('download',    'global',  'Unlock / download track', 'Unlock a Suno track for download', 'allowance',  2, 'stream', 1, 'day', true, 100),
  ('vault',       'global',  'Reveal vault item',       'Reveal a Real-OG vault credential', 'subscription', 0, 'vip',  NULL, NULL, false, 110),

  -- Feature gates (no coin cost)
  ('live_roast',   'jokes',  'Live Roast',          'Live joke roast generator',           'subscription', 0, 'vip',  NULL, NULL, false, 200),
  ('boss_console', 'admin',  'Boss console',        'Boss / admin operations console',     'subscription', 0, 'boss', NULL, NULL, false, 300),

  -- TradeHUB scans — first 3/day are free for non-VIPs (matches apply_trade_scan)
  ('trade:scan',   'trade',  'Run trade scan',      'Generate a market signal scan',       'allowance',    1, 'stream', 3, 'day', false, 410),

  -- View-only / always-free actions
  ('portal:view',  'global', 'View a portal',       'Open and view any public portal',     'free',         0, 'visitor', NULL, NULL, false, 900);

-- ---------------------------------------------------------------
-- Helper: resolve the live billing rule for an action key.
-- Returns NULL when the key is unknown or inactive.
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_action_billing(_action_key text)
RETURNS public.action_billing
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.action_billing
   WHERE action_key = _action_key AND active = true
   LIMIT 1
$$;