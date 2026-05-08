ALTER TABLE public.portals ADD COLUMN IF NOT EXISTS audio_url text;
ALTER TABLE public.portals ADD COLUMN IF NOT EXISTS lyric_text text;

CREATE TABLE IF NOT EXISTS public.suno_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id text UNIQUE NOT NULL,
  portal_id uuid,
  portal_slug text,
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  prompt text,
  style_tags text,
  title text,
  make_instrumental boolean NOT NULL DEFAULT false,
  audio_url text,
  lyric_text text,
  image_url text,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_suno_jobs_user ON public.suno_jobs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_suno_jobs_portal ON public.suno_jobs(portal_id);

ALTER TABLE public.suno_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view own suno jobs"
  ON public.suno_jobs FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins manage suno jobs"
  ON public.suno_jobs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_suno_jobs_touch
  BEFORE UPDATE ON public.suno_jobs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.suno_jobs REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.suno_jobs;