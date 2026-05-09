-- 1. Settings table
CREATE TABLE IF NOT EXISTS public.civility_settings (
  id integer PRIMARY KEY DEFAULT 1,
  swear_default boolean NOT NULL DEFAULT true,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid,
  CONSTRAINT civility_settings_singleton CHECK (id = 1)
);

INSERT INTO public.civility_settings (id, swear_default) VALUES (1, true)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.civility_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read civility"
  ON public.civility_settings FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Boss writes civility"
  ON public.civility_settings FOR ALL
  TO authenticated
  USING (public.is_boss(auth.uid()) OR public.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (public.is_boss(auth.uid()) OR public.has_role(auth.uid(),'admin'::app_role));

-- 2. Helper that returns the live default
CREATE OR REPLACE FUNCTION public.civility_default()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT COALESCE((SELECT swear_default FROM public.civility_settings WHERE id = 1), true);
$$;

-- 3. Wire the default into the three target tables
ALTER TABLE public.portals     ALTER COLUMN swear_chat_enabled SET DEFAULT public.civility_default();
ALTER TABLE public.battles     ALTER COLUMN swear_chat_enabled SET DEFAULT public.civility_default();
ALTER TABLE public.custom_hubs ALTER COLUMN swear_chat_enabled SET DEFAULT public.civility_default();