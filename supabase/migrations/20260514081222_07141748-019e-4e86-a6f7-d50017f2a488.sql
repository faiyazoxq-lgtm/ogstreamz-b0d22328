
-- 1) Sanitized public view for calculators (mirrors portals_public pattern).
--    Strips VIP-only config keys (deepExplanation, steps, kidExplain) which
--    are delivered separately via the getToolVipContent server function.
CREATE OR REPLACE VIEW public.calculators_public AS
SELECT
  c.id,
  c.slug,
  c.name,
  c.description,
  c.vip,
  c.published,
  c.created_at,
  (COALESCE(c.config, '{}'::jsonb)
     - 'deepExplanation'
     - 'steps'
     - 'kidExplain') AS config
FROM public.calculators c
WHERE c.published = true;

GRANT SELECT ON public.calculators_public TO anon, authenticated;

-- 2) Replace the broad anon SELECT on calculators with an authenticated-only
--    policy. Anonymous visitors must go through calculators_public, which
--    cannot leak VIP-only fields.
DROP POLICY IF EXISTS "Anyone can view published calculators" ON public.calculators;

CREATE POLICY "Authenticated can view published calculators"
  ON public.calculators
  FOR SELECT
  TO authenticated
  USING (published = true);

-- 3) card_waitlist: ensure submitted email matches the authenticated user's
--    own auth email so users can't store (and read back) someone else's email.
DROP POLICY IF EXISTS "Members insert own waitlist row" ON public.card_waitlist;

CREATE POLICY "Members insert own waitlist row"
  ON public.card_waitlist
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND lower(email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
  );
