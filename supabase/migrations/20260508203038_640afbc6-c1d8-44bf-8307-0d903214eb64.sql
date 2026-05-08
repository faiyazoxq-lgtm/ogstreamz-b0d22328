ALTER TABLE public.portals
  ADD COLUMN IF NOT EXISTS telegram_config jsonb NOT NULL DEFAULT '{}'::jsonb;