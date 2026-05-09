-- =========================================================================
-- 1) Privilege escalation: prevent self-update of sensitive profile columns
-- =========================================================================
CREATE OR REPLACE FUNCTION public.guard_profile_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Boss/admin can change anything
  IF public.is_boss(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  -- Everyone else cannot touch privilege-bearing columns on their own row
  IF NEW.rank IS DISTINCT FROM OLD.rank
     OR NEW.credits IS DISTINCT FROM OLD.credits
     OR NEW.subscription_plan IS DISTINCT FROM OLD.subscription_plan
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.feature_flags IS DISTINCT FROM OLD.feature_flags
     OR NEW.referred_by_reseller IS DISTINCT FROM OLD.referred_by_reseller
     OR NEW.email IS DISTINCT FROM OLD.email
     OR NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Not allowed to modify privileged profile fields';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_profile_self_update_trg ON public.profiles;
CREATE TRIGGER guard_profile_self_update_trg
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_self_update();

-- =========================================================================
-- 2) Reseller downline: drop the broad SELECT policy
--    (server-side reseller dashboard will use admin client with a column allowlist)
-- =========================================================================
DROP POLICY IF EXISTS "Reseller views downline" ON public.profiles;

-- =========================================================================
-- 3) portal_marketing: no public read
-- =========================================================================
DROP POLICY IF EXISTS "Public can read portal marketing" ON public.portal_marketing;

-- Also drop the duplicate ALL policy that targets {public} role (admin gated).
-- Re-create scoped to authenticated.
DROP POLICY IF EXISTS "Admins manage portal marketing" ON public.portal_marketing;
CREATE POLICY "Admins manage portal marketing"
  ON public.portal_marketing
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- =========================================================================
-- 4) bot_configs: only authenticated users may read active bots
-- =========================================================================
DROP POLICY IF EXISTS "Public read active bots" ON public.bot_configs;
CREATE POLICY "Authenticated read active bots"
  ON public.bot_configs
  FOR SELECT
  TO authenticated
  USING (active = true);

-- =========================================================================
-- 5) subscriptions: remove duplicate {public}-role policies
-- =========================================================================
DROP POLICY IF EXISTS "Admins view all subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can view own subscription" ON public.subscriptions;
-- The {authenticated} versions ("Admins can view all subscriptions",
-- "Members can view their own subscription") remain.

-- =========================================================================
-- 6) connect_leads: campaign owners can read their own leads
-- =========================================================================
CREATE POLICY "Campaign owners read own leads"
  ON public.connect_leads
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.connect_campaigns c
    WHERE c.id = connect_leads.campaign_id
      AND c.created_by = auth.uid()
  ));

-- =========================================================================
-- 7) tracks: hide full_path from public reads via column-level revoke + view
--    (front-end reads tracks publicly for previews; full_path must be
--     fetched server-side via admin client only.)
-- =========================================================================
REVOKE SELECT (full_path) ON public.tracks FROM anon, authenticated;

-- =========================================================================
-- 8) Tighten always-true INSERT WITH CHECK policies
-- =========================================================================
-- ai_logs: drop the anon-insert path (only service role / triggers should write)
DROP POLICY IF EXISTS "Service writes ai logs" ON public.ai_logs;
DROP POLICY IF EXISTS "Authenticated insert ai logs" ON public.ai_logs;
CREATE POLICY "Authenticated insert own ai logs"
  ON public.ai_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

-- battle_plays: scope inserts to current user (anon kept as session-only insert)
DROP POLICY IF EXISTS "Anyone insert battle plays" ON public.battle_plays;
CREATE POLICY "Authenticated insert own battle plays"
  ON public.battle_plays
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());
CREATE POLICY "Anon insert anonymous battle plays"
  ON public.battle_plays
  FOR INSERT
  TO anon
  WITH CHECK (user_id IS NULL);

-- boss_chat_messages: only boss may insert (was {public} with check true).
DROP POLICY IF EXISTS "Anyone authenticated can insert boss chat" ON public.boss_chat_messages;
CREATE POLICY "Boss inserts boss chat"
  ON public.boss_chat_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (is_boss(auth.uid()));
