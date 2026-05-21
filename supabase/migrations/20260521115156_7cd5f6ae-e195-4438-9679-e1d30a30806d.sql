
CREATE OR REPLACE FUNCTION public.find_user_by_stream_credentials(_username text, _password text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  k text;
  v_user uuid;
BEGIN
  IF _username IS NULL OR length(trim(_username)) = 0 THEN RETURN NULL; END IF;
  IF _password IS NULL OR length(_password) = 0 THEN RETURN NULL; END IF;

  k := public._stream_link_secret();

  SELECT user_id INTO v_user
  FROM public.stream_account_links
  WHERE pgp_sym_decrypt(enc_username, k) = _username
    AND pgp_sym_decrypt(enc_password, k) = _password
  ORDER BY updated_at DESC NULLS LAST
  LIMIT 1;

  RETURN v_user;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.find_user_by_stream_credentials(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.find_user_by_stream_credentials(text, text) TO service_role;
