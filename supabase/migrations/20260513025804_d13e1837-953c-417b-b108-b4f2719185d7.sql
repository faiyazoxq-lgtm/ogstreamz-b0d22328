-- 1. profiles.member_tier
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS member_tier text;

COMMENT ON COLUMN public.profiles.member_tier IS
  'Optional sub-rank flag. Currently used: og_streamz_member (purchased stream profile, below VIP).';

-- 2. pass_orders state machine columns for the boss telegram reply flow
ALTER TABLE public.pass_orders
  ADD COLUMN IF NOT EXISTS boss_chat_id bigint,
  ADD COLUMN IF NOT EXISTS boss_draft_state text NOT NULL DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS boss_draft_username text;

-- Constrain values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pass_orders_boss_draft_state_chk'
  ) THEN
    ALTER TABLE public.pass_orders
      ADD CONSTRAINT pass_orders_boss_draft_state_chk
      CHECK (boss_draft_state IN ('idle','awaiting_username','awaiting_password','delivered'));
  END IF;
END $$;

-- 3. Boss-only: record creds + tag user. Returns jsonb with member chat_id + email.
CREATE OR REPLACE FUNCTION public.boss_record_stream_credentials(
  _order_id uuid,
  _username text,
  _password text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  k text;
  v_user uuid;
  v_email text;
  v_chat_id bigint;
  v_duration_days int;
  v_expires_at timestamptz;
BEGIN
  IF NOT (public.is_boss(auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role)) THEN
    RAISE EXCEPTION 'Boss only';
  END IF;

  IF _username IS NULL OR length(trim(_username)) = 0 THEN
    RAISE EXCEPTION 'Username required';
  END IF;
  IF _password IS NULL OR length(trim(_password)) = 0 THEN
    RAISE EXCEPTION 'Password required';
  END IF;

  SELECT po.user_id, po.duration_days
    INTO v_user, v_duration_days
  FROM public.pass_orders po
  WHERE po.id = _order_id;

  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  k := public._stream_link_secret();
  v_expires_at := now() + (v_duration_days || ' days')::interval;

  INSERT INTO public.stream_account_links
    (user_id, enc_username, enc_password, enc_server, status, expires_at)
  VALUES
    (v_user,
     pgp_sym_encrypt(_username, k),
     pgp_sym_encrypt(_password, k),
     pgp_sym_encrypt('', k),
     'active',
     v_expires_at)
  ON CONFLICT (user_id) DO UPDATE SET
    enc_username = EXCLUDED.enc_username,
    enc_password = EXCLUDED.enc_password,
    status       = 'active',
    expires_at   = EXCLUDED.expires_at,
    updated_at   = now();

  -- Tag the user as OG-Streamz member (don't downgrade vip / boss).
  UPDATE public.profiles
  SET member_tier = COALESCE(member_tier, 'og_streamz_member'),
      member_tier = CASE
        WHEN rank IN ('vip','boss') THEN member_tier
        ELSE 'og_streamz_member'
      END,
      stream_status = 'active',
      stream_expires_at = v_expires_at,
      updated_at = now()
  WHERE id = v_user;

  -- Mark order delivered, clear draft.
  UPDATE public.pass_orders
  SET status = 'delivered',
      boss_draft_state = 'delivered',
      boss_draft_username = NULL,
      decided_by = auth.uid(),
      decided_at = now(),
      updated_at = now()
  WHERE id = _order_id;

  SELECT p.email INTO v_email FROM public.profiles p WHERE p.id = v_user;
  SELECT tul.chat_id INTO v_chat_id
    FROM public.telegram_user_links tul
    WHERE tul.user_id = v_user
    LIMIT 1;

  RETURN jsonb_build_object(
    'ok', true,
    'user_id', v_user,
    'email', v_email,
    'chat_id', v_chat_id,
    'expires_at', v_expires_at
  );
END $$;

REVOKE EXECUTE ON FUNCTION public.boss_record_stream_credentials(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.boss_record_stream_credentials(uuid,text,text) TO authenticated, service_role;

-- 4. Self-serve: user reads their own decrypted creds.
CREATE OR REPLACE FUNCTION public.get_my_stream_credentials()
RETURNS TABLE(
  username text,
  password text,
  status text,
  expires_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE k text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  k := public._stream_link_secret();
  RETURN QUERY
    SELECT pgp_sym_decrypt(l.enc_username, k)::text AS username,
           CASE WHEN l.enc_password IS NULL THEN NULL
                ELSE pgp_sym_decrypt(l.enc_password, k)::text END AS password,
           l.status,
           l.expires_at,
           l.updated_at
    FROM public.stream_account_links l
    WHERE l.user_id = auth.uid();
END $$;

REVOKE EXECUTE ON FUNCTION public.get_my_stream_credentials() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_stream_credentials() TO authenticated;