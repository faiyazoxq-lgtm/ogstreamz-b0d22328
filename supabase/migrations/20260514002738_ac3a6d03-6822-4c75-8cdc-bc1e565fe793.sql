ALTER TABLE public.suno_jobs
  ADD COLUMN IF NOT EXISTS audio_url_v1 text,
  ADD COLUMN IF NOT EXISTS audio_url_v2 text,
  ADD COLUMN IF NOT EXISTS image_url_v1 text,
  ADD COLUMN IF NOT EXISTS image_url_v2 text,
  ADD COLUMN IF NOT EXISTS download_unlocked_at timestamptz;