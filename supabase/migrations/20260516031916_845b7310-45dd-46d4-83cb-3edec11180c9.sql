CREATE TABLE public.telegram_chat_prefs (
  chat_id BIGINT PRIMARY KEY,
  swearing_enabled BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.telegram_chat_prefs ENABLE ROW LEVEL SECURITY;
-- No policies: service role bypasses RLS; no client/anon access intended.