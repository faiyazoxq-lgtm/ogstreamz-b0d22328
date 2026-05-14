CREATE TABLE IF NOT EXISTS public.og_bot_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  surface text NOT NULL,
  tool text NOT NULL,
  args jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  ok boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS og_bot_audit_user_created_idx
  ON public.og_bot_audit (user_id, created_at DESC);

ALTER TABLE public.og_bot_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read own og_bot_audit" ON public.og_bot_audit;
CREATE POLICY "users read own og_bot_audit"
  ON public.og_bot_audit FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "users insert own og_bot_audit" ON public.og_bot_audit;
CREATE POLICY "users insert own og_bot_audit"
  ON public.og_bot_audit FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
