
ALTER TABLE public.portals
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'joke',
  ADD COLUMN IF NOT EXISTS style text;

ALTER TABLE public.custom_track_requests
  ADD COLUMN IF NOT EXISTS portal_slug text,
  ADD COLUMN IF NOT EXISTS lyrics text;
