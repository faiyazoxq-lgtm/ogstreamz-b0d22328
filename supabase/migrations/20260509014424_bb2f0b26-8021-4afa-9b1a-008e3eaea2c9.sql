
CREATE TABLE IF NOT EXISTS public.ai_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source text NOT NULL DEFAULT 'enforcer',
  level text NOT NULL DEFAULT 'info',
  message text NOT NULL,
  mood text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  user_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_logs_created_at ON public.ai_logs (created_at DESC);

ALTER TABLE public.ai_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Boss reads ai logs"
  ON public.ai_logs FOR SELECT TO authenticated
  USING (is_boss(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated insert ai logs"
  ON public.ai_logs FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Service writes ai logs"
  ON public.ai_logs FOR INSERT TO anon
  WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_logs;
ALTER TABLE public.ai_logs REPLICA IDENTITY FULL;
