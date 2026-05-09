
CREATE TABLE public.custom_hubs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  tagline text NOT NULL DEFAULT '',
  href text NOT NULL,
  icon text NOT NULL DEFAULT 'Sparkles',
  accent text NOT NULL DEFAULT '#3ad6ff',
  sort_order integer NOT NULL DEFAULT 0,
  published boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.custom_hubs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read published hubs"
  ON public.custom_hubs FOR SELECT
  USING (published = true OR public.is_boss(auth.uid()));

CREATE POLICY "Boss manages hubs"
  ON public.custom_hubs FOR ALL
  TO authenticated
  USING (public.is_boss(auth.uid()))
  WITH CHECK (public.is_boss(auth.uid()));

CREATE TRIGGER touch_custom_hubs_updated_at
  BEFORE UPDATE ON public.custom_hubs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
