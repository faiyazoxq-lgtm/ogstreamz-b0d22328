CREATE TABLE IF NOT EXISTS public.realtime_denial_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  topic text NOT NULL,
  status text NOT NULL,
  reason text,
  user_agent text,
  ip text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS realtime_denial_log_created_at_idx
  ON public.realtime_denial_log (created_at DESC);

ALTER TABLE public.realtime_denial_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can record realtime denial" ON public.realtime_denial_log;
CREATE POLICY "Anyone can record realtime denial"
ON public.realtime_denial_log
FOR INSERT
TO anon, authenticated
WITH CHECK (
  (user_id IS NULL OR user_id = auth.uid())
  AND length(topic) BETWEEN 1 AND 200
  AND length(status) BETWEEN 1 AND 64
  AND length(COALESCE(reason, '')) <= 500
  AND length(COALESCE(user_agent, '')) <= 500
  AND length(COALESCE(ip, '')) <= 64
);

DROP POLICY IF EXISTS "Boss reads realtime denials" ON public.realtime_denial_log;
CREATE POLICY "Boss reads realtime denials"
ON public.realtime_denial_log
FOR SELECT
TO authenticated
USING (is_boss(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));
