
-- ============================================================================
-- 1. function_grant_revocations: log every revoke with restore SQL
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.function_grant_revocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  signature text NOT NULL,
  role_name text NOT NULL,
  reason text NOT NULL DEFAULT '',
  restore_sql text NOT NULL,
  revoked_at timestamptz NOT NULL DEFAULT now(),
  revoked_by uuid,
  restored_at timestamptz,
  restored_by uuid,
  status text NOT NULL DEFAULT 'revoked' -- revoked | restored
);

ALTER TABLE public.function_grant_revocations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Boss reads grant log" ON public.function_grant_revocations;
CREATE POLICY "Boss reads grant log" ON public.function_grant_revocations
  FOR SELECT TO authenticated
  USING (public.is_boss(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Boss writes grant log" ON public.function_grant_revocations;
CREATE POLICY "Boss writes grant log" ON public.function_grant_revocations
  FOR ALL TO authenticated
  USING (public.is_boss(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.is_boss(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));

-- ============================================================================
-- 2. boss_function_ideas: brainstorming backlog
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.boss_function_ideas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  summary text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'plugin',
  priority text NOT NULL DEFAULT 'P2',
  status text NOT NULL DEFAULT 'idea',
  notes text NOT NULL DEFAULT '',
  link text,
  position integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.boss_function_ideas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Boss reads function ideas" ON public.boss_function_ideas;
CREATE POLICY "Boss reads function ideas" ON public.boss_function_ideas
  FOR SELECT TO authenticated
  USING (public.is_boss(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Boss writes function ideas" ON public.boss_function_ideas;
CREATE POLICY "Boss writes function ideas" ON public.boss_function_ideas
  FOR ALL TO authenticated
  USING (public.is_boss(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.is_boss(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.touch_boss_function_ideas()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_boss_function_ideas ON public.boss_function_ideas;
CREATE TRIGGER trg_touch_boss_function_ideas
  BEFORE UPDATE ON public.boss_function_ideas
  FOR EACH ROW EXECUTE FUNCTION public.touch_boss_function_ideas();

-- ============================================================================
-- 3. RPCs to revoke/restore EXECUTE with logging
-- ============================================================================
CREATE OR REPLACE FUNCTION public.boss_revoke_function_execute(
  _signature text,
  _role_name text,
  _reason text DEFAULT ''
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id uuid;
  v_restore text;
  v_clean_role text;
BEGIN
  IF NOT (public.is_boss(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- Validate role to prevent SQL injection
  v_clean_role := lower(trim(_role_name));
  IF v_clean_role NOT IN ('anon','authenticated','public') THEN
    RAISE EXCEPTION 'invalid role: %', _role_name;
  END IF;

  -- Validate signature exists in public schema (signature = "name(args)")
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' = _signature
  ) THEN
    RAISE EXCEPTION 'unknown function signature: %', _signature;
  END IF;

  v_restore := format('GRANT EXECUTE ON FUNCTION public.%s TO %I;', _signature, v_clean_role);

  EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM %I;', _signature, v_clean_role);

  INSERT INTO public.function_grant_revocations (signature, role_name, reason, restore_sql, revoked_by)
  VALUES (_signature, v_clean_role, COALESCE(_reason,''), v_restore, auth.uid())
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.boss_revoke_function_execute(text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.boss_revoke_function_execute(text,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.boss_restore_function_execute(_log_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.function_grant_revocations%ROWTYPE;
BEGIN
  IF NOT (public.is_boss(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT * INTO v_row FROM public.function_grant_revocations WHERE id = _log_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'log entry not found'; END IF;
  IF v_row.status = 'restored' THEN RETURN true; END IF;

  -- restore_sql is built server-side from validated inputs only
  EXECUTE v_row.restore_sql;

  UPDATE public.function_grant_revocations
  SET status = 'restored', restored_at = now(), restored_by = auth.uid()
  WHERE id = _log_id;

  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.boss_restore_function_execute(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.boss_restore_function_execute(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.boss_list_function_grant_log()
RETURNS SETOF public.function_grant_revocations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.is_boss(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY SELECT * FROM public.function_grant_revocations ORDER BY revoked_at DESC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.boss_list_function_grant_log() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.boss_list_function_grant_log() TO authenticated;

-- ============================================================================
-- 4. Seed Boss Function Ideas
-- ============================================================================
INSERT INTO public.boss_function_ideas (title, summary, category, priority, status, position) VALUES
  ('Telegram broadcast composer', 'One-click broadcast to every active bot fleet channel with media + scheduling.', 'plugin', 'P1', 'idea', 10),
  ('AI portal copy refresher', 'Cron job that re-pitches stale portals every 30 days using current market context.', 'automation', 'P2', 'idea', 20),
  ('Stripe revenue heat-map', 'Daily/weekly/monthly revenue chart across all SKUs with churn flags.', 'analytics', 'P2', 'idea', 30),
  ('Webhook health monitor', 'Watch all incoming /api/public/* endpoints and alert on signature failures or 5xx spikes.', 'ops', 'P1', 'idea', 40),
  ('Vault credential rotator', 'Schedule auto-rotation of agent_api_keys with rollback window.', 'security', 'P1', 'idea', 50),
  ('Reseller commission ledger', 'Track per-reseller credit markup, payout schedule, and statements.', 'money', 'P2', 'idea', 60),
  ('Battle outcome leaderboard', 'Public leaderboard of best/worst battle session outcomes for engagement.', 'engagement', 'P3', 'idea', 70),
  ('Magic-link abuse throttle', 'Rate-limit magic_link_audit by email + IP and auto-blacklist abusers.', 'security', 'P1', 'idea', 80),
  ('Backup snapshot exporter', 'Boss-triggered export of critical tables to encrypted bucket.', 'ops', 'P2', 'idea', 90),
  ('Realtime presence dashboard', 'See who is on which portal right now with session timers.', 'analytics', 'P3', 'idea', 100)
ON CONFLICT DO NOTHING;
