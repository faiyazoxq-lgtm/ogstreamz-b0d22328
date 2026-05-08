
CREATE TABLE public.tracks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  portal_slug text NOT NULL,
  title text NOT NULL,
  preview_path text,
  full_path text,
  price_cents integer NOT NULL DEFAULT 200,
  currency text NOT NULL DEFAULT 'usd',
  suno_prompt text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_tracks_portal ON public.tracks(portal_slug);

ALTER TABLE public.tracks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone view tracks" ON public.tracks FOR SELECT USING (true);
CREATE POLICY "Admins manage tracks" ON public.tracks FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER tracks_touch BEFORE UPDATE ON public.tracks
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.track_purchases (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  track_id uuid NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
  stripe_session_id text NOT NULL UNIQUE,
  amount_cents integer NOT NULL,
  currency text NOT NULL DEFAULT 'usd',
  environment text NOT NULL DEFAULT 'sandbox',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_track_purchases_user ON public.track_purchases(user_id);
CREATE INDEX idx_track_purchases_track ON public.track_purchases(track_id);

ALTER TABLE public.track_purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view own purchases" ON public.track_purchases FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Admins view all purchases" ON public.track_purchases FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Private storage bucket for tracks
INSERT INTO storage.buckets (id, name, public) VALUES ('tracks', 'tracks', false)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Admins upload tracks" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'tracks' AND has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins update tracks" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'tracks' AND has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins delete tracks" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'tracks' AND has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins read tracks" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'tracks' AND has_role(auth.uid(), 'admin'::app_role));
