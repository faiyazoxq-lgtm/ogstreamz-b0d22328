CREATE TABLE public.telegram_auth_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event TEXT NOT NULL,
  user_id UUID,
  chat_id BIGINT,
  dest_path TEXT,
  token_prefix TEXT,
  reason TEXT,
  ip TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tg_auth_audit_user ON public.telegram_auth_audit(user_id, created_at DESC);
CREATE INDEX idx_tg_auth_audit_event ON public.telegram_auth_audit(event, created_at DESC);
CREATE INDEX idx_tg_auth_audit_created ON public.telegram_auth_audit(created_at DESC);

ALTER TABLE public.telegram_auth_audit ENABLE ROW LEVEL SECURITY;
-- No policies: service role only. Clients must never read audit trails.