-- Service-role-only RPC: find a user_id by their (decrypted) stream username.
-- Used by the "Continue with OG Streamz profile" sign-in flow on the website,
-- after the IPTV provider has already verified the password.
CREATE OR REPLACE FUNCTION public.find_user_id_by_stream_username(_username text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  k text;
  uid uuid;
BEGIN
  IF _username IS NULL OR length(btrim(_username)) = 0 THEN
    RETURN NULL;
  END IF;
  k := public._stream_link_secret();
  SELECT l.user_id INTO uid
  FROM public.stream_account_links l
  WHERE lower(pgp_sym_decrypt(l.enc_username, k)::text) = lower(btrim(_username))
  LIMIT 1;
  RETURN uid;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.find_user_id_by_stream_username(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.find_user_id_by_stream_username(text) TO service_role;