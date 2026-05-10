CREATE TABLE public.magic_link_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  status text NOT NULL CHECK (status IN ('requested','sent','failed','consumed')),
  error_message text,
  redirect_to text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_magic_link_audit_email_created
  ON public.magic_link_audit (lower(email), created_at DESC);

ALTER TABLE public.magic_link_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone may record a magic link attempt"
  ON public.magic_link_audit
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    email IS NOT NULL
    AND length(email) BETWEEN 3 AND 320
    AND length(coalesce(error_message,'')) <= 500
    AND length(coalesce(redirect_to,'')) <= 500
    AND length(coalesce(user_agent,''))   <= 500
  );

CREATE POLICY "Boss and admins read magic link audit"
  ON public.magic_link_audit
  FOR SELECT
  TO authenticated
  USING (public.is_boss(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));
