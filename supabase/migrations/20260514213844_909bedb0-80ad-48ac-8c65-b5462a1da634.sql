-- Boss audit log: append-only record of mutating Boss actions.
CREATE TABLE IF NOT EXISTS public.boss_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_id UUID NOT NULL,
  action TEXT NOT NULL,
  surface TEXT NOT NULL DEFAULT '/boss',
  target_user_id UUID,
  before_value JSONB,
  after_value JSONB,
  reason TEXT,
  ip TEXT,
  user_agent TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_boss_audit_log_created_at
  ON public.boss_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_boss_audit_log_target_user
  ON public.boss_audit_log (target_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_boss_audit_log_actor
  ON public.boss_audit_log (actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_boss_audit_log_action
  ON public.boss_audit_log (action, created_at DESC);

ALTER TABLE public.boss_audit_log ENABLE ROW LEVEL SECURITY;

-- Read access: Boss + admin only.
CREATE POLICY "Boss and admin can read audit log"
  ON public.boss_audit_log
  FOR SELECT
  TO authenticated
  USING (public.is_boss(auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role));

-- Block all direct writes — every entry must flow through record_boss_action().
CREATE POLICY "No direct inserts"
  ON public.boss_audit_log
  FOR INSERT
  TO authenticated
  WITH CHECK (false);

CREATE POLICY "No updates"
  ON public.boss_audit_log
  FOR UPDATE
  TO authenticated
  USING (false);

CREATE POLICY "No deletes"
  ON public.boss_audit_log
  FOR DELETE
  TO authenticated
  USING (false);

-- Append-only writer; actor is bound to auth.uid() and gated to Boss/admin.
CREATE OR REPLACE FUNCTION public.record_boss_action(
  _action TEXT,
  _surface TEXT DEFAULT '/boss',
  _target_user_id UUID DEFAULT NULL,
  _before JSONB DEFAULT NULL,
  _after JSONB DEFAULT NULL,
  _reason TEXT DEFAULT NULL,
  _ip TEXT DEFAULT NULL,
  _user_agent TEXT DEFAULT NULL,
  _metadata JSONB DEFAULT '{}'::jsonb
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller UUID := auth.uid();
  new_id UUID;
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'Auth required';
  END IF;
  IF NOT (public.is_boss(caller) OR public.has_role(caller, 'admin'::public.app_role)) THEN
    RAISE EXCEPTION 'Boss only';
  END IF;
  IF _action IS NULL OR length(trim(_action)) = 0 THEN
    RAISE EXCEPTION 'action required';
  END IF;

  INSERT INTO public.boss_audit_log (
    actor_id, action, surface, target_user_id,
    before_value, after_value, reason, ip, user_agent, metadata
  ) VALUES (
    caller,
    left(trim(_action), 80),
    COALESCE(left(trim(_surface), 120), '/boss'),
    _target_user_id,
    _before,
    _after,
    NULLIF(left(COALESCE(_reason, ''), 500), ''),
    NULLIF(left(COALESCE(_ip, ''), 64), ''),
    NULLIF(left(COALESCE(_user_agent, ''), 500), ''),
    COALESCE(_metadata, '{}'::jsonb)
  ) RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_boss_action(
  TEXT, TEXT, UUID, JSONB, JSONB, TEXT, TEXT, TEXT, JSONB
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_boss_action(
  TEXT, TEXT, UUID, JSONB, JSONB, TEXT, TEXT, TEXT, JSONB
) TO authenticated;