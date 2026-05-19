CREATE TABLE public.telegram_auth_tokens (
  token TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dest_path TEXT NOT NULL DEFAULT '/',
  chat_id BIGINT,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_telegram_auth_tokens_user ON public.telegram_auth_tokens(user_id);
CREATE INDEX idx_telegram_auth_tokens_expires ON public.telegram_auth_tokens(expires_at);

ALTER TABLE public.telegram_auth_tokens ENABLE ROW LEVEL SECURITY;
-- No policies: only the service role (server) reads/writes these tokens.
-- Clients must never see other users' single-use auth tokens.