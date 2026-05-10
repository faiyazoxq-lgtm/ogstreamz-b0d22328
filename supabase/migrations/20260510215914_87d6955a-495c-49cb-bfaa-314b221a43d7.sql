
-- 1) Track Boss verification separately from auto-detected verification
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS stream_boss_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS stream_auto_checked_at timestamptz;

-- 2) Persist encrypted password on the boss-only link so we can re-probe later
ALTER TABLE public.stream_account_links
  ADD COLUMN IF NOT EXISTS enc_password bytea;

-- 3) Replace boss_link_stream_account so it accepts (and stores) the password
CREATE OR REPLACE FUNCTION public.boss_link_stream_account(
  _user_id uuid, _username text, _password text, _server text,
  _status text, _expires_at timestamptz, _notes text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE k text; out_id uuid;
BEGIN
  IF NOT (public.is_boss(auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role)) THEN
    RAISE EXCEPTION 'Boss only';
  END IF;
  IF _username IS NULL OR length(trim(_username)) = 0 THEN
    RAISE EXCEPTION 'Username required';
  END IF;
  k := public._stream_link_secret();
  INSERT INTO public.stream_account_links
    (user_id, enc_username, enc_password, enc_server, status, expires_at, notes)
  VALUES (_user_id,
          pgp_sym_encrypt(_username, k),
          CASE WHEN _password IS NOT NULL AND _password <> '' THEN pgp_sym_encrypt(_password, k) ELSE NULL END,
          pgp_sym_encrypt(COALESCE(_server, ''), k),
          _status, _expires_at, _notes)
  ON CONFLICT (user_id) DO UPDATE SET
    enc_username = EXCLUDED.enc_username,
    enc_password = COALESCE(EXCLUDED.enc_password, public.stream_account_links.enc_password),
    enc_server = EXCLUDED.enc_server,
    status = EXCLUDED.status,
    expires_at = EXCLUDED.expires_at,
    notes = COALESCE(EXCLUDED.notes, public.stream_account_links.notes),
    updated_at = now()
  RETURNING id INTO out_id;
  RETURN out_id;
END $$;

-- 4) On Boss approval: forward the password into the link table and stamp boss verification
CREATE OR REPLACE FUNCTION public.boss_decide_stream_request(_id uuid, _approve boolean, _note text DEFAULT NULL::text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r public.stream_verification_requests; k text; uname text; pwd text; srv text;
BEGIN
  IF NOT (public.is_boss(auth.uid()) OR public.has_role(auth.uid(),'admin'::public.app_role)) THEN
    RAISE EXCEPTION 'Boss only';
  END IF;
  SELECT * INTO r FROM public.stream_verification_requests WHERE id = _id FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF r.status <> 'pending' THEN RAISE EXCEPTION 'Already decided (%)', r.status; END IF;

  k := public._stream_link_secret();
  uname := pgp_sym_decrypt(r.enc_username, k)::text;
  pwd   := CASE WHEN r.enc_password IS NOT NULL THEN pgp_sym_decrypt(r.enc_password, k)::text ELSE '' END;
  srv   := NULLIF(pgp_sym_decrypt(r.enc_server, k)::text, '');

  IF _approve THEN
    PERFORM public.boss_link_stream_account(
      r.user_id, uname, pwd, srv, COALESCE(r.auto_status,'Active'), r.auto_expires_at, _note
    );
    UPDATE public.profiles
      SET stream_status = COALESCE(r.auto_status,'Active'),
          stream_verified_at = now(),
          stream_boss_verified_at = now(),
          stream_expires_at  = r.auto_expires_at,
          rank = CASE WHEN rank IN ('prospect','enforcer') THEN 'stream_user'::public.syndicate_rank ELSE rank END,
          updated_at = now()
      WHERE id = r.user_id;
    UPDATE public.stream_verification_requests
      SET status='approved',
          decision_note=COALESCE(left(_note,500),''),
          decided_by=auth.uid(), decided_at=now(),
          enc_password=NULL
      WHERE id=_id;
    RETURN jsonb_build_object('status','approved','user_id',r.user_id);
  ELSE
    UPDATE public.stream_verification_requests
      SET status='rejected',
          decision_note=COALESCE(left(_note,500),''),
          decided_by=auth.uid(), decided_at=now(),
          enc_password=NULL
      WHERE id=_id;
    RETURN jsonb_build_object('status','rejected','user_id',r.user_id);
  END IF;
END $$;

-- 5) Self-service: get my own decrypted stream creds for re-probing
CREATE OR REPLACE FUNCTION public.get_my_stream_creds()
 RETURNS TABLE(username text, password text, server text)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE k text; uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Auth required'; END IF;
  k := public._stream_link_secret();
  RETURN QUERY
    SELECT pgp_sym_decrypt(l.enc_username, k)::text,
           CASE WHEN l.enc_password IS NOT NULL THEN pgp_sym_decrypt(l.enc_password, k)::text ELSE NULL END,
           NULLIF(pgp_sym_decrypt(l.enc_server, k)::text, '')
      FROM public.stream_account_links l
     WHERE l.user_id = uid;
END $$;

-- 6) After a probe, the user (or boss) writes the fresh status/expiry back
CREATE OR REPLACE FUNCTION public.apply_auto_stream_status(
  _user_id uuid, _status text, _expires_at timestamptz
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Auth required'; END IF;
  IF auth.uid() <> _user_id AND NOT (public.is_boss(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role)) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  UPDATE public.profiles
     SET stream_status = COALESCE(_status, stream_status),
         stream_expires_at = COALESCE(_expires_at, stream_expires_at),
         stream_auto_checked_at = now(),
         updated_at = now()
   WHERE id = _user_id;
  -- Also keep the link table fresh for Boss reporting
  UPDATE public.stream_account_links
     SET status = COALESCE(_status, status),
         expires_at = COALESCE(_expires_at, expires_at),
         updated_at = now()
   WHERE user_id = _user_id;
END $$;
