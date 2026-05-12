
-- 1) Lock down sensitive columns on tracks from authenticated/anon roles.
REVOKE SELECT (full_path, suno_prompt) ON public.tracks FROM anon, authenticated;
GRANT SELECT ON public.tracks TO service_role;

-- 2) Audit log for stream URL mint attempts (rate-limit + abuse forensics).
CREATE TABLE IF NOT EXISTS public.stream_url_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  ip TEXT,
  user_agent TEXT,
  action TEXT NOT NULL,
  success BOOLEAN NOT NULL,
  reason TEXT,
  token_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stream_url_audit_user_time
  ON public.stream_url_audit(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stream_url_audit_ip_time
  ON public.stream_url_audit(ip, created_at DESC);

ALTER TABLE public.stream_url_audit ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.stream_url_audit FROM anon, authenticated;
GRANT ALL ON public.stream_url_audit TO service_role;

-- Boss/admin can read the audit log via the API (service_role bypasses RLS for
-- internal jobs; this lets boss inspect via PostgREST too).
CREATE POLICY "Boss reads stream url audit"
  ON public.stream_url_audit
  FOR SELECT
  TO authenticated
  USING (is_boss(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));
