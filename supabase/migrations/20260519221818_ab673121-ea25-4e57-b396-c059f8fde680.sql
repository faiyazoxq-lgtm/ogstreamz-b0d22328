CREATE TABLE IF NOT EXISTS public.portal_joke_views (
  user_id UUID NOT NULL,
  portal_id UUID NOT NULL REFERENCES public.portals(id) ON DELETE CASCADE,
  joke_key TEXT NOT NULL,
  seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, portal_id, joke_key)
);

CREATE INDEX IF NOT EXISTS idx_portal_joke_views_user_portal
  ON public.portal_joke_views (user_id, portal_id);

ALTER TABLE public.portal_joke_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own joke views"
  ON public.portal_joke_views FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own joke views"
  ON public.portal_joke_views FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own joke views"
  ON public.portal_joke_views FOR DELETE
  USING (auth.uid() = user_id);