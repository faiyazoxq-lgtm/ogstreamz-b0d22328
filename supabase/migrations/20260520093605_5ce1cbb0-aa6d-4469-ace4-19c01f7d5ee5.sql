-- Add IPTV credential capture fields to telegram_user_links so the bot can
-- collect, store (encrypted at rest) and re-check a member's stream line.
ALTER TABLE public.telegram_user_links
  ADD COLUMN IF NOT EXISTS iptv_enc_username bytea,
  ADD COLUMN IF NOT EXISTS iptv_enc_password bytea,
  ADD COLUMN IF NOT EXISTS iptv_status text,
  ADD COLUMN IF NOT EXISTS iptv_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS iptv_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS iptv_draft_username text;

-- Service-role-only RPC: persist freshly captured IPTV creds for the chat.
CREATE OR REPLACE FUNCTION public.tg_set_iptv_creds(
  _chat_id bigint,
  _username text,
  _password text,
  _status text,
  _expires_at timestamptz
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE k text;
BEGIN
  k := public._stream_link_secret();
  UPDATE public.telegram_user_links
     SET iptv_enc_username = pgp_sym_encrypt(_username, k),
         iptv_enc_password = pgp_sym_encrypt(_password, k),
         iptv_status       = _status,
         iptv_expires_at   = _expires_at,
         iptv_checked_at   = now(),
         iptv_draft_username = NULL,
         updated_at        = now()
   WHERE chat_id = _chat_id;
END $$;

REVOKE ALL ON FUNCTION public.tg_set_iptv_creds(bigint,text,text,text,timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tg_set_iptv_creds(bigint,text,text,text,timestamptz) TO service_role;

-- Service-role-only RPC: return decrypted creds for re-probing.
CREATE OR REPLACE FUNCTION public.tg_get_iptv_creds(_chat_id bigint)
RETURNS TABLE(username text, password text, status text, expires_at timestamptz, checked_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE k text;
BEGIN
  k := public._stream_link_secret();
  RETURN QUERY
    SELECT
      CASE WHEN l.iptv_enc_username IS NOT NULL THEN pgp_sym_decrypt(l.iptv_enc_username, k)::text END,
      CASE WHEN l.iptv_enc_password IS NOT NULL THEN pgp_sym_decrypt(l.iptv_enc_password, k)::text END,
      l.iptv_status,
      l.iptv_expires_at,
      l.iptv_checked_at
    FROM public.telegram_user_links l
    WHERE l.chat_id = _chat_id;
END $$;

REVOKE ALL ON FUNCTION public.tg_get_iptv_creds(bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tg_get_iptv_creds(bigint) TO service_role;

-- Service-role-only: update the last-known status/expiry without re-writing creds.
CREATE OR REPLACE FUNCTION public.tg_set_iptv_status(
  _chat_id bigint,
  _status text,
  _expires_at timestamptz
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.telegram_user_links
     SET iptv_status     = COALESCE(_status, iptv_status),
         iptv_expires_at = COALESCE(_expires_at, iptv_expires_at),
         iptv_checked_at = now(),
         updated_at      = now()
   WHERE chat_id = _chat_id;
END $$;

REVOKE ALL ON FUNCTION public.tg_set_iptv_status(bigint,text,timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tg_set_iptv_status(bigint,text,timestamptz) TO service_role;