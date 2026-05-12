CREATE TABLE public.boss_contacts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  label text NOT NULL,
  phone text NOT NULL,
  notes text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.boss_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Boss reads contacts" ON public.boss_contacts
  FOR SELECT TO authenticated
  USING (is_boss(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Boss writes contacts" ON public.boss_contacts
  FOR ALL TO authenticated
  USING (is_boss(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (is_boss(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER touch_boss_contacts
  BEFORE UPDATE ON public.boss_contacts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.boss_contacts (label, phone, notes)
  VALUES ('SPARE A11', '07347265145', '');