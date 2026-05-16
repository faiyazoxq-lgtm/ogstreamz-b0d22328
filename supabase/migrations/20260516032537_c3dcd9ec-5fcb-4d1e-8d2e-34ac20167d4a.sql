ALTER TABLE public.telegram_chat_prefs
  ADD COLUMN IF NOT EXISTS tg_username text,
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS started_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS last_start_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_telegram_chat_prefs_tg_username
  ON public.telegram_chat_prefs (tg_username)
  WHERE tg_username IS NOT NULL;