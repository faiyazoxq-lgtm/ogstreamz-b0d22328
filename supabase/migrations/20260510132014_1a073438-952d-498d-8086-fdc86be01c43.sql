
-- 1. Add encrypted columns
ALTER TABLE public.stream_verification_requests
  ADD COLUMN IF NOT EXISTS enc_username bytea,
  ADD COLUMN IF NOT EXISTS enc_server   bytea,
  ADD COLUMN IF NOT EXISTS enc_password bytea,
  ADD COLUMN IF NOT EXISTS enc_payload  bytea;

-- 2. Migrate existing rows
DO $$
DECLARE k text;
BEGIN
  k := public._stream_link_secret();
  UPDATE public.stream_verification_requests
     SET enc_username = pgp_sym_encrypt(COALESCE(username, ''), k),
         enc_server   = pgp_sym_encrypt(COALESCE(server, ''), k),
         enc_password = CASE WHEN password IS NOT NULL AND password <> ''
                              THEN pgp_sym_encrypt(password, k) ELSE NULL END,
         enc_payload  = CASE WHEN auto_payload IS NOT NULL
                              THEN pgp_sym_encrypt(auto_payload::text, k) ELSE NULL END
   WHERE enc_username IS NULL;
END $$;

-- 3. Drop plaintext columns
ALTER TABLE public.stream_verification_requests
  DROP COLUMN IF EXISTS username,
  DROP COLUMN IF EXISTS password,
  DROP COLUMN IF EXISTS server,
  DROP COLUMN IF EXISTS auto_payload;

-- 4. Lock down direct reads/writes — RLS deny-all; access only through SECURITY DEFINER funcs
ALTER TABLE public.stream_verification_requests ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies
            WHERE schemaname='public' AND tablename='stream_verification_requests'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.stream_verification_requests', p.policyname);
  END LOOP;
END $$;
-- (no policies = deny-all to anon/auth roles; SECURITY DEFINER funcs continue to work)

REVOKE ALL ON public.stream_verification_requests FROM anon, authenticated;

-- 5. Replace enqueue function — encrypt all fields on insert
CREATE OR REPLACE FUNCTION public.enqueue_stream_verification(
  _user_id uuid, _username text, _password text, _server text,
  _auto_status text, _auto_expires_at timestamptz, _auto_payload jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE new_id uuid; k text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Auth required'; END IF;
  IF auth.uid() <> _user_id AND NOT (public.is_boss(auth.uid()) OR public.has_role(auth.uid(),'admin'::public.app_role)) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  k := public._stream_link_secret();

  UPDATE public.stream_verification_requests
     SET status='superseded', updated_at=now(),
         enc_password = NULL  -- scrub any old pending password
   WHERE user_id=_user_id AND status='pending';

  INSERT INTO public.stream_verification_requests
    (user_id, enc_username, enc_password, enc_server, auto_status, auto_expires_at, enc_payload)
  VALUES
    (_user_id,
     pgp_sym_encrypt(COALESCE(_username,''), k),
     CASE WHEN _password IS NOT NULL AND _password <> '' THEN pgp_sym_encrypt(_password, k) ELSE NULL END,
     pgp_sym_encrypt(COALESCE(_server,''), k),
     _auto_status, _auto_expires_at,
     CASE WHEN _auto_payload IS NOT NULL THEN pgp_sym_encrypt(_auto_payload::text, k) ELSE NULL END)
  RETURNING id INTO new_id;
  RETURN new_id;
END $$;

-- 6. Replace decide function — decrypts to call boss_link_stream_account, then scrubs
CREATE OR REPLACE FUNCTION public.boss_decide_stream_request(
  _id uuid, _approve boolean, _note text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE r public.stream_verification_requests; k text; uname text; srv text;
BEGIN
  IF NOT (public.is_boss(auth.uid()) OR public.has_role(auth.uid(),'admin'::public.app_role)) THEN
    RAISE EXCEPTION 'Boss only';
  END IF;
  SELECT * INTO r FROM public.stream_verification_requests WHERE id = _id FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF r.status <> 'pending' THEN RAISE EXCEPTION 'Already decided (%)', r.status; END IF;

  k := public._stream_link_secret();
  uname := pgp_sym_decrypt(r.enc_username, k)::text;
  srv   := NULLIF(pgp_sym_decrypt(r.enc_server, k)::text, '');

  IF _approve THEN
    PERFORM public.boss_link_stream_account(
      r.user_id, uname, srv, COALESCE(r.auto_status,'Active'), r.auto_expires_at, _note
    );
    UPDATE public.profiles
      SET stream_status = COALESCE(r.auto_status,'Active'),
          stream_verified_at = now(),
          stream_expires_at  = r.auto_expires_at,
          rank = CASE WHEN rank IN ('prospect','enforcer') THEN 'stream_user'::public.syndicate_rank ELSE rank END,
          updated_at = now()
      WHERE id = r.user_id;
    UPDATE public.stream_verification_requests
      SET status='approved',
          decision_note=COALESCE(left(_note,500),''),
          decided_by=auth.uid(), decided_at=now(),
          enc_password=NULL  -- immediately scrub credential
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

-- 7. Boss-only listing — decrypts and joins profile
CREATE OR REPLACE FUNCTION public.boss_list_stream_requests(_status text)
RETURNS TABLE(
  id uuid, user_id uuid, email text, rank text,
  username text, server text, has_password boolean,
  auto_status text, auto_expires_at timestamptz,
  status text, decision_note text, decided_at timestamptz, created_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE k text;
BEGIN
  IF NOT (public.is_boss(auth.uid()) OR public.has_role(auth.uid(),'admin'::public.app_role)) THEN
    RAISE EXCEPTION 'Boss only';
  END IF;
  k := public._stream_link_secret();
  RETURN QUERY
    SELECT r.id, r.user_id, p.email, p.rank::text,
           pgp_sym_decrypt(r.enc_username, k)::text AS username,
           NULLIF(pgp_sym_decrypt(r.enc_server, k)::text, '') AS server,
           (r.enc_password IS NOT NULL) AS has_password,
           r.auto_status, r.auto_expires_at,
           r.status, r.decision_note, r.decided_at, r.created_at
      FROM public.stream_verification_requests r
      LEFT JOIN public.profiles p ON p.id = r.user_id
     WHERE r.status = _status
     ORDER BY r.created_at DESC
     LIMIT 200;
END $$;

REVOKE ALL ON FUNCTION public.boss_list_stream_requests(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.boss_list_stream_requests(text) TO authenticated;

-- 8. Purge function — wipe credential bytes after 7d post-decision; delete rows older than 30d
CREATE OR REPLACE FUNCTION public.purge_stream_verification_requests()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE wiped int; deleted int;
BEGIN
  IF NOT (public.is_boss(auth.uid()) OR public.has_role(auth.uid(),'admin'::public.app_role)) THEN
    RAISE EXCEPTION 'Boss only';
  END IF;
  UPDATE public.stream_verification_requests
     SET enc_username = NULL, enc_server = NULL,
         enc_password = NULL, enc_payload = NULL,
         updated_at = now()
   WHERE status <> 'pending'
     AND decided_at IS NOT NULL
     AND decided_at < now() - interval '7 days'
     AND (enc_username IS NOT NULL OR enc_server IS NOT NULL
          OR enc_password IS NOT NULL OR enc_payload IS NOT NULL);
  GET DIAGNOSTICS wiped = ROW_COUNT;

  DELETE FROM public.stream_verification_requests
   WHERE status <> 'pending'
     AND decided_at IS NOT NULL
     AND decided_at < now() - interval '30 days';
  GET DIAGNOSTICS deleted = ROW_COUNT;

  RETURN jsonb_build_object('wiped', wiped, 'deleted', deleted);
END $$;
