-- Payment mode toggle (boss-controlled)
CREATE TABLE IF NOT EXISTS public.payments_settings (
  id integer PRIMARY KEY DEFAULT 1,
  mode text NOT NULL DEFAULT 'test' CHECK (mode IN ('test','live')),
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payments_settings_singleton CHECK (id = 1)
);

INSERT INTO public.payments_settings (id, mode) VALUES (1, 'test')
  ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.payments_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payments_settings readable to all" ON public.payments_settings;
CREATE POLICY "payments_settings readable to all"
  ON public.payments_settings FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "payments_settings boss update" ON public.payments_settings;
CREATE POLICY "payments_settings boss update"
  ON public.payments_settings FOR UPDATE
  USING (public.is_boss(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.is_boss(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));

ALTER PUBLICATION supabase_realtime ADD TABLE public.payments_settings;