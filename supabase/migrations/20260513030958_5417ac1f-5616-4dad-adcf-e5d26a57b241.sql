
ALTER TABLE public.boss_settings
  ADD COLUMN IF NOT EXISTS gsheet_last_push_at timestamptz,
  ADD COLUMN IF NOT EXISTS gsheet_last_pull_inserted integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gsheet_last_pull_updated  integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gsheet_last_push_count    integer NOT NULL DEFAULT 0;
