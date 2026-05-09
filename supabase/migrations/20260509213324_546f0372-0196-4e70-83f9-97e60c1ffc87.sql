-- Retention policy for anonymous portal view analytics
CREATE TABLE IF NOT EXISTS public.analytics_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  retention_days integer NOT NULL DEFAULT 90 CHECK (retention_days BETWEEN 1 AND 3650),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

INSERT INTO public.analytics_settings (id, retention_days)
VALUES (1, 90)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.analytics_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read analytics settings"
  ON public.analytics_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Boss writes analytics settings"
  ON public.analytics_settings FOR ALL
  TO authenticated
  USING (public.is_boss(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.is_boss(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));

-- Purge function: deletes view events older than the configured retention window.
CREATE OR REPLACE FUNCTION public.purge_portal_view_events()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  days integer;
  deleted integer;
BEGIN
  SELECT COALESCE(retention_days, 90) INTO days
    FROM public.analytics_settings WHERE id = 1;
  IF days IS NULL THEN days := 90; END IF;

  DELETE FROM public.portal_view_events
   WHERE created_at < now() - (days || ' days')::interval;
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_portal_view_events() FROM public, anon, authenticated;

-- Boss-only manual trigger (calls the SECURITY DEFINER purge)
CREATE OR REPLACE FUNCTION public.boss_purge_view_events()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.is_boss(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role)) THEN
    RAISE EXCEPTION 'Boss only';
  END IF;
  RETURN public.purge_portal_view_events();
END;
$$;

CREATE EXTENSION IF NOT EXISTS pg_cron;