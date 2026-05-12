CREATE TABLE IF NOT EXISTS public.portal_use_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  portal_id uuid,
  portal_slug text NOT NULL,
  cost integer NOT NULL DEFAULT 0,
  free boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS portal_use_audit_created_at_idx
  ON public.portal_use_audit (created_at DESC);
CREATE INDEX IF NOT EXISTS portal_use_audit_slug_idx
  ON public.portal_use_audit (portal_slug, created_at DESC);
CREATE INDEX IF NOT EXISTS portal_use_audit_user_idx
  ON public.portal_use_audit (user_id, created_at DESC);

ALTER TABLE public.portal_use_audit ENABLE ROW LEVEL SECURITY;

-- Users can see their own usage history
CREATE POLICY "Users can view their own portal usage"
  ON public.portal_use_audit
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Boss / admin can see everything
CREATE POLICY "Boss and admin can view all portal usage"
  ON public.portal_use_audit
  FOR SELECT
  TO authenticated
  USING (public.is_boss(auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role));

-- No client INSERT/UPDATE/DELETE policies: writes happen via server-side
-- service-role calls in the chargePortalUse server function.
