ALTER TABLE public.store_settings
  ADD COLUMN IF NOT EXISTS stream_portal_url text NOT NULL DEFAULT 'https://ogstreamz.co.uk';