CREATE TABLE IF NOT EXISTS public.form_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_id uuid NOT NULL REFERENCES public.portals(id) ON DELETE CASCADE,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  submitter_email text,
  telegram_sent boolean NOT NULL DEFAULT false,
  ip_hint text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_form_submissions_portal ON public.form_submissions(portal_id, created_at DESC);

ALTER TABLE public.form_submissions ENABLE ROW LEVEL SECURITY;

-- Anyone can submit to any published form portal. Validation that the
-- target portal is `kind='form'` and `published=true` happens in the
-- server function, not RLS, so we keep the policy simple here.
CREATE POLICY "Anyone can submit to a form portal"
  ON public.form_submissions
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Boss and admin can read submissions"
  ON public.form_submissions
  FOR SELECT
  TO authenticated
  USING (public.is_boss(auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Boss and admin can delete submissions"
  ON public.form_submissions
  FOR DELETE
  TO authenticated
  USING (public.is_boss(auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role));