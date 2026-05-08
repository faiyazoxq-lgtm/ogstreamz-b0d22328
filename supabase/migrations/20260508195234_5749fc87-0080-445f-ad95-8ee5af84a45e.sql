
CREATE TABLE public.portals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  niche text NOT NULL,
  language text NOT NULL DEFAULT 'English',
  vibe text,
  theme text NOT NULL DEFAULT 'street',
  jokes jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.portals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view portals" ON public.portals FOR SELECT USING (true);
CREATE POLICY "Admins manage portals" ON public.portals FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER portals_touch BEFORE UPDATE ON public.portals
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
