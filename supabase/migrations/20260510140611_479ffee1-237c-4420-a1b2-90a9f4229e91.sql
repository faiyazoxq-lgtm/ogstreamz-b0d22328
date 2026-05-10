DO $$ BEGIN
  CREATE TYPE public.system_alert_category AS ENUM ('fallback','api_error');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.system_alert_severity AS ENUM ('info','warn','error');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.system_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category public.system_alert_category NOT NULL,
  severity public.system_alert_severity NOT NULL DEFAULT 'warn',
  source text NOT NULL,
  title text NOT NULL,
  message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  related_job_id uuid,
  acknowledged_by uuid,
  acknowledged_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_system_alerts_unack_created
  ON public.system_alerts (created_at DESC) WHERE acknowledged_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_system_alerts_category
  ON public.system_alerts (category, created_at DESC);

ALTER TABLE public.system_alerts ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_boss_or_admin(_uid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = _uid AND p.rank = 'boss'
  ) OR EXISTS (
    SELECT 1 FROM public.user_roles r
    WHERE r.user_id = _uid AND r.role = 'admin'::app_role
  );
$$;

DROP POLICY IF EXISTS "Boss can view alerts" ON public.system_alerts;
CREATE POLICY "Boss can view alerts" ON public.system_alerts
FOR SELECT TO authenticated
USING (public.is_boss_or_admin(auth.uid()));

DROP POLICY IF EXISTS "Boss can insert alerts" ON public.system_alerts;
CREATE POLICY "Boss can insert alerts" ON public.system_alerts
FOR INSERT TO authenticated
WITH CHECK (public.is_boss_or_admin(auth.uid()));

DROP POLICY IF EXISTS "Boss can update alerts" ON public.system_alerts;
CREATE POLICY "Boss can update alerts" ON public.system_alerts
FOR UPDATE TO authenticated
USING (public.is_boss_or_admin(auth.uid()));

ALTER TABLE public.system_alerts REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='system_alerts'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.system_alerts';
  END IF;
END $$;

ALTER TABLE public.suno_jobs
  ADD COLUMN IF NOT EXISTS fallback_provider text,
  ADD COLUMN IF NOT EXISTS fallback_brief jsonb;