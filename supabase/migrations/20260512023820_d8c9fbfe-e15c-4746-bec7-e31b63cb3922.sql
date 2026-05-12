
-- Table to store hashed, time-limited stream URL tokens
CREATE TABLE IF NOT EXISTS public.stream_url_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id UUID NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  revoked BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_stream_url_tokens_user ON public.stream_url_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_stream_url_tokens_expires ON public.stream_url_tokens(expires_at);

ALTER TABLE public.stream_url_tokens ENABLE ROW LEVEL SECURITY;
-- No policies = no access for anon/authenticated. service_role bypasses RLS.

REVOKE ALL ON public.stream_url_tokens FROM anon, authenticated;
GRANT ALL ON public.stream_url_tokens TO service_role;

-- Admin-only RPC: decrypt stream credentials for an arbitrary user.
-- Only callable by service_role.
CREATE OR REPLACE FUNCTION public.get_stream_creds_for(_user_id UUID)
RETURNS TABLE(username TEXT, password TEXT, server TEXT)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE k TEXT;
BEGIN
  k := public._stream_link_secret();
  RETURN QUERY
    SELECT pgp_sym_decrypt(l.enc_username, k)::text,
           CASE WHEN l.enc_password IS NOT NULL THEN pgp_sym_decrypt(l.enc_password, k)::text ELSE NULL END,
           NULLIF(pgp_sym_decrypt(l.enc_server, k)::text, '')
      FROM public.stream_account_links l
     WHERE l.user_id = _user_id;
END $$;

REVOKE ALL ON FUNCTION public.get_stream_creds_for(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_stream_creds_for(UUID) TO service_role;
