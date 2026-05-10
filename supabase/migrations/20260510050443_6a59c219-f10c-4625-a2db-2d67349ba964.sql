ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS stream_links jsonb NOT NULL DEFAULT '{}'::jsonb;