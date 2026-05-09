-- Anonymous public-view analytics for portals & battles
CREATE TABLE IF NOT EXISTS public.portal_view_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('portal','battle')),
  slug text NOT NULL,
  visitor_id text,
  referrer text,
  user_agent text,
  path text,
  country text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pve_slug_created ON public.portal_view_events (kind, slug, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pve_created ON public.portal_view_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pve_visitor ON public.portal_view_events (visitor_id);

ALTER TABLE public.portal_view_events ENABLE ROW LEVEL SECURITY;

-- Anyone (anon or signed-in) may log a view event; never read or modify
CREATE POLICY "Anon insert view events"
  ON public.portal_view_events FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Auth insert view events"
  ON public.portal_view_events FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Boss / admin can read all events
CREATE POLICY "Boss reads view events"
  ON public.portal_view_events FOR SELECT
  TO authenticated
  USING (public.is_boss(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));