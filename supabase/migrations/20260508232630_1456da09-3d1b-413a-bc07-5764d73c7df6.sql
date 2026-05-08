
CREATE TABLE public.vip_passes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  granted_by uuid,
  source text NOT NULL DEFAULT 'custom',
  notes text,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_vip_passes_user ON public.vip_passes(user_id, expires_at DESC);

ALTER TABLE public.vip_passes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Boss manages vip passes" ON public.vip_passes
  FOR ALL TO authenticated
  USING (public.is_boss(auth.uid()))
  WITH CHECK (public.is_boss(auth.uid()));

CREATE POLICY "Users view own vip passes" ON public.vip_passes
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.boss_grant_vip_pass(
  _user_id uuid, _expires_at timestamptz, _source text, _notes text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pid uuid;
BEGIN
  IF NOT public.is_boss(auth.uid()) THEN RAISE EXCEPTION 'Boss only'; END IF;
  IF _expires_at <= now() THEN RAISE EXCEPTION 'expires_at must be in the future'; END IF;

  INSERT INTO public.vip_passes (user_id, granted_by, source, notes, expires_at)
    VALUES (_user_id, auth.uid(), COALESCE(NULLIF(_source,''),'custom'), _notes, _expires_at)
    RETURNING id INTO pid;

  UPDATE public.profiles
    SET status = 'vip'::account_status,
        rank = CASE WHEN rank IN ('boss'::syndicate_rank) THEN rank ELSE 'vip'::syndicate_rank END,
        updated_at = now()
    WHERE id = _user_id;
  RETURN pid;
END $$;

CREATE OR REPLACE FUNCTION public.boss_revoke_vip_pass(_pass_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid;
BEGIN
  IF NOT public.is_boss(auth.uid()) THEN RAISE EXCEPTION 'Boss only'; END IF;
  UPDATE public.vip_passes SET revoked_at = now(), expires_at = LEAST(expires_at, now())
    WHERE id = _pass_id RETURNING user_id INTO uid;
  IF uid IS NULL THEN RAISE EXCEPTION 'Pass not found'; END IF;

  -- if user has no other active passes, downgrade status to free (rank kept)
  IF NOT EXISTS (
    SELECT 1 FROM public.vip_passes
    WHERE user_id = uid AND revoked_at IS NULL AND expires_at > now()
  ) THEN
    UPDATE public.profiles
      SET status = CASE WHEN rank = 'boss' THEN status ELSE 'free'::account_status END,
          updated_at = now()
      WHERE id = uid;
  END IF;
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.has_active_vip(_user uuid DEFAULT auth.uid(), _env text DEFAULT 'sandbox')
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions s
    WHERE s.user_id = _user AND s.environment = _env
      AND ((s.status IN ('active','trialing','past_due') AND (s.current_period_end IS NULL OR s.current_period_end > now()))
        OR (s.status = 'canceled' AND s.current_period_end > now()))
  )
  OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = _user AND p.status = 'vip')
  OR EXISTS (SELECT 1 FROM public.vip_passes v
             WHERE v.user_id = _user AND v.revoked_at IS NULL AND v.expires_at > now());
$$;
