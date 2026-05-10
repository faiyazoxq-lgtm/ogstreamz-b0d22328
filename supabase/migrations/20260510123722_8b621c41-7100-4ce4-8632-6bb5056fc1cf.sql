-- Encryption support
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Private singleton table holding the symmetric key. RLS on, no policies = no API access.
CREATE TABLE IF NOT EXISTS public._stream_link_key (
  id int PRIMARY KEY DEFAULT 1,
  key text NOT NULL,
  CONSTRAINT _stream_link_key_singleton CHECK (id = 1)
);
ALTER TABLE public._stream_link_key ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public._stream_link_key FROM PUBLIC, anon, authenticated;
INSERT INTO public._stream_link_key (id, key)
  VALUES (1, encode(gen_random_bytes(32), 'hex'))
  ON CONFLICT (id) DO NOTHING;

-- Encrypted Boss-only link table
CREATE TABLE IF NOT EXISTS public.stream_account_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  enc_username bytea NOT NULL,
  enc_server bytea,
  status text,
  expires_at timestamptz,
  linked_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  notes text
);
ALTER TABLE public.stream_account_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.stream_account_links FROM PUBLIC, anon, authenticated;
-- No policies — only SECURITY DEFINER helpers below can touch this table.

CREATE OR REPLACE FUNCTION public._stream_link_secret()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT key FROM public._stream_link_key WHERE id = 1
$$;
REVOKE EXECUTE ON FUNCTION public._stream_link_secret() FROM PUBLIC, anon, authenticated;

-- Boss helpers
CREATE OR REPLACE FUNCTION public.boss_link_stream_account(
  _user_id uuid,
  _username text,
  _server text,
  _status text,
  _expires_at timestamptz,
  _notes text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
    (user_id, enc_username, enc_server, status, expires_at, notes)
  VALUES (_user_id,
          pgp_sym_encrypt(_username, k),
          pgp_sym_encrypt(COALESCE(_server, ''), k),
          _status, _expires_at, _notes)
  ON CONFLICT (user_id) DO UPDATE SET
    enc_username = EXCLUDED.enc_username,
    enc_server = EXCLUDED.enc_server,
    status = EXCLUDED.status,
    expires_at = EXCLUDED.expires_at,
    notes = COALESCE(EXCLUDED.notes, public.stream_account_links.notes),
    updated_at = now()
  RETURNING id INTO out_id;
  RETURN out_id;
END $$;
REVOKE EXECUTE ON FUNCTION public.boss_link_stream_account(uuid,text,text,text,timestamptz,text) FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.boss_list_stream_links()
RETURNS TABLE(
  id uuid, user_id uuid, email text, username text, server text,
  status text, expires_at timestamptz, linked_at timestamptz,
  updated_at timestamptz, notes text
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE k text;
BEGIN
  IF NOT (public.is_boss(auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role)) THEN
    RAISE EXCEPTION 'Boss only';
  END IF;
  k := public._stream_link_secret();
  RETURN QUERY
    SELECT l.id, l.user_id, p.email,
           pgp_sym_decrypt(l.enc_username, k)::text,
           NULLIF(pgp_sym_decrypt(l.enc_server, k)::text, ''),
           l.status, l.expires_at, l.linked_at, l.updated_at, l.notes
    FROM public.stream_account_links l
    LEFT JOIN public.profiles p ON p.id = l.user_id
    ORDER BY l.updated_at DESC;
END $$;
REVOKE EXECUTE ON FUNCTION public.boss_list_stream_links() FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.boss_unlink_stream_account(_user_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.is_boss(auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role)) THEN
    RAISE EXCEPTION 'Boss only';
  END IF;
  DELETE FROM public.stream_account_links WHERE user_id = _user_id;
  RETURN FOUND;
END $$;
REVOKE EXECUTE ON FUNCTION public.boss_unlink_stream_account(uuid) FROM PUBLIC, anon;

-- Stop persisting any stream credentials onto the public profile.
-- set_stream_credentials becomes a no-op-by-design wrt password and only used by legacy callers.
CREATE OR REPLACE FUNCTION public.set_stream_credentials(_user_id uuid, _username text, _password text, _server text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Auth required';
  END IF;
  IF auth.uid() <> _user_id AND NOT (public.is_boss(auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role)) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  -- Intentionally do NOT write stream_username/password/server onto profiles.
  -- The verification request flow holds the credentials until Boss decides.
  RETURN;
END $$;

-- Approve flow: write encrypted link, never expose creds on profile, scrub password from request.
CREATE OR REPLACE FUNCTION public.boss_decide_stream_request(_id uuid, _approve boolean, _note text DEFAULT NULL::text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.stream_verification_requests;
BEGIN
  IF NOT (public.is_boss(auth.uid()) OR public.has_role(auth.uid(),'admin'::public.app_role)) THEN
    RAISE EXCEPTION 'Boss only';
  END IF;
  SELECT * INTO r FROM public.stream_verification_requests WHERE id = _id FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF r.status <> 'pending' THEN RAISE EXCEPTION 'Already decided (%)', r.status; END IF;

  IF _approve THEN
    PERFORM public.boss_link_stream_account(
      r.user_id, r.username, r.server, COALESCE(r.auto_status, 'Active'), r.auto_expires_at, _note
    );

    UPDATE public.profiles
      SET stream_status = COALESCE(r.auto_status, 'Active'),
          stream_verified_at = now(),
          stream_expires_at = r.auto_expires_at,
          rank = CASE
            WHEN rank IN ('prospect','enforcer') THEN 'stream_user'::public.syndicate_rank
            ELSE rank
          END,
          updated_at = now()
      WHERE id = r.user_id;

    UPDATE public.stream_verification_requests
      SET status='approved',
          decision_note=COALESCE(left(_note,500),''),
          decided_by=auth.uid(),
          decided_at=now(),
          password=''  -- scrub credential after decision
      WHERE id = _id;
    RETURN jsonb_build_object('status','approved','user_id',r.user_id);
  ELSE
    UPDATE public.stream_verification_requests
      SET status='rejected',
          decision_note=COALESCE(left(_note,500),''),
          decided_by=auth.uid(),
          decided_at=now(),
          password=''  -- scrub credential after decision
      WHERE id = _id;
    RETURN jsonb_build_object('status','rejected','user_id',r.user_id);
  END IF;
END $$;

-- Migrate any existing profile-linked accounts into the encrypted link table, then drop columns.
DO $$
DECLARE r record; k text;
BEGIN
  SELECT key INTO k FROM public._stream_link_key WHERE id = 1;
  FOR r IN
    SELECT id, stream_username, stream_server, stream_status, stream_expires_at
    FROM public.profiles
    WHERE stream_username IS NOT NULL AND length(trim(stream_username)) > 0
  LOOP
    INSERT INTO public.stream_account_links
      (user_id, enc_username, enc_server, status, expires_at, notes)
    VALUES (r.id,
            pgp_sym_encrypt(r.stream_username, k),
            pgp_sym_encrypt(COALESCE(r.stream_server, ''), k),
            r.stream_status, r.stream_expires_at, 'migrated_from_profile')
    ON CONFLICT (user_id) DO NOTHING;
  END LOOP;
END $$;

ALTER TABLE public.profiles DROP COLUMN IF EXISTS stream_username;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS stream_password;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS stream_server;