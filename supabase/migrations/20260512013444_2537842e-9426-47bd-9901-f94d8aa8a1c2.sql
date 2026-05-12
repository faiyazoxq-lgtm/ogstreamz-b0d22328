-- Portal headers (one row per portal, cached forever)
CREATE TABLE IF NOT EXISTS public.portal_headers (
  portal_key TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  bg_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.portal_headers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Portal headers are readable by everyone"
  ON public.portal_headers FOR SELECT
  USING (true);

-- Service role bypasses RLS automatically; no insert/update policy needed for
-- regular users — generation is owned by the server.

CREATE TRIGGER portal_headers_touch_updated_at
  BEFORE UPDATE ON public.portal_headers
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Per-user creations library
CREATE TABLE IF NOT EXISTS public.portal_creations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  portal_key TEXT NOT NULL,
  prompt TEXT NOT NULL,
  output JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portal_creations_user_portal
  ON public.portal_creations (user_id, portal_key, created_at DESC);

ALTER TABLE public.portal_creations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own portal creations"
  ON public.portal_creations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own portal creations"
  ON public.portal_creations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own portal creations"
  ON public.portal_creations FOR DELETE
  USING (auth.uid() = user_id);

-- Public storage bucket for AI-generated portal backgrounds
INSERT INTO storage.buckets (id, name, public)
  VALUES ('portal-bg', 'portal-bg', true)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Portal bg public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'portal-bg');