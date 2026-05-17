CREATE OR REPLACE FUNCTION public.boss_list_vip_pass_pool()
RETURNS TABLE(
  id uuid,
  label text,
  code text,
  username text,
  password text,
  active boolean,
  sort_order integer,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  k text;
BEGIN
  IF NOT (public.is_boss(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role)) THEN
    RAISE EXCEPTION 'Boss only';
  END IF;

  k := public._stream_link_secret();

  RETURN QUERY
    SELECT
      v.id,
      v.label,
      COALESCE(v.code, '')::text,
      CASE
        WHEN v.enc_username IS NULL THEN ''::text
        ELSE extensions.pgp_sym_decrypt(v.enc_username, k)::text
      END,
      CASE
        WHEN v.enc_password IS NULL THEN ''::text
        ELSE extensions.pgp_sym_decrypt(v.enc_password, k)::text
      END,
      v.active,
      v.sort_order,
      v.created_at,
      v.updated_at
    FROM public.vip_pass_pool v
    ORDER BY v.sort_order ASC, v.created_at ASC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.boss_upsert_vip_pass_pool(
  _id uuid,
  _label text,
  _code text,
  _active boolean,
  _sort_order integer,
  _username text DEFAULT NULL::text,
  _password text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  out_id uuid;
  k text;
  has_code boolean := _code IS NOT NULL AND length(trim(_code)) > 0;
  has_user boolean := _username IS NOT NULL AND length(trim(_username)) > 0;
  has_pass boolean := _password IS NOT NULL AND length(trim(_password)) > 0;
BEGIN
  IF NOT (public.is_boss(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role)) THEN
    RAISE EXCEPTION 'Boss only';
  END IF;

  IF NOT has_code AND NOT (has_user AND has_pass) THEN
    RAISE EXCEPTION 'Provide a code OR a username and password';
  END IF;

  k := public._stream_link_secret();

  IF _id IS NULL THEN
    INSERT INTO public.vip_pass_pool
      (label, code, enc_username, enc_password, active, sort_order, created_by)
    VALUES (
      COALESCE(_label, ''),
      CASE WHEN has_code THEN trim(_code) ELSE '' END,
      CASE WHEN has_user THEN extensions.pgp_sym_encrypt(trim(_username), k) ELSE NULL END,
      CASE WHEN has_pass THEN extensions.pgp_sym_encrypt(trim(_password), k) ELSE NULL END,
      COALESCE(_active, true),
      COALESCE(_sort_order, 0),
      auth.uid()
    )
    RETURNING id INTO out_id;
  ELSE
    UPDATE public.vip_pass_pool
       SET label        = COALESCE(_label, label),
           code         = CASE WHEN has_code THEN trim(_code) ELSE code END,
           enc_username = CASE WHEN has_user THEN extensions.pgp_sym_encrypt(trim(_username), k) ELSE enc_username END,
           enc_password = CASE WHEN has_pass THEN extensions.pgp_sym_encrypt(trim(_password), k) ELSE enc_password END,
           active       = COALESCE(_active, active),
           sort_order   = COALESCE(_sort_order, sort_order),
           updated_at   = now()
     WHERE id = _id
     RETURNING id INTO out_id;

    IF out_id IS NULL THEN
      RAISE EXCEPTION 'Pass not found';
    END IF;
  END IF;

  RETURN out_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.reveal_vip_pass()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  cur public.vip_pass_reveals;
  pool_row public.vip_pass_pool;
  pool_size int;
  ttl_secs int := 900;
  expiry timestamptz;
  k text;
  uname text;
  pword text;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING errcode = '42501';
  END IF;

  IF NOT public.is_real_og(uid) THEN
    RAISE EXCEPTION 'Real OG / VIP pass required' USING errcode = '42501';
  END IF;

  k := public._stream_link_secret();

  SELECT r.* INTO cur
    FROM public.vip_pass_reveals r
    JOIN public.vip_pass_pool p ON p.id = r.pool_id
   WHERE r.user_id = uid
     AND r.expires_at > now()
     AND p.active = true
   ORDER BY r.revealed_at DESC
   LIMIT 1;

  IF cur.id IS NOT NULL THEN
    SELECT * INTO pool_row FROM public.vip_pass_pool WHERE id = cur.pool_id;
    SELECT count(*) INTO pool_size FROM public.vip_pass_pool WHERE active = true;

    uname := CASE WHEN pool_row.enc_username IS NULL THEN NULL ELSE extensions.pgp_sym_decrypt(pool_row.enc_username, k)::text END;
    pword := CASE WHEN pool_row.enc_password IS NULL THEN NULL ELSE extensions.pgp_sym_decrypt(pool_row.enc_password, k)::text END;

    RETURN jsonb_build_object(
      'available', true,
      'label', pool_row.label,
      'code', COALESCE(pool_row.code, ''),
      'username', uname,
      'password', pword,
      'revealed_at', cur.revealed_at,
      'expires_at', cur.expires_at,
      'expires_in', greatest(0, extract(epoch from (cur.expires_at - now()))::int),
      'pool_size', pool_size
    );
  END IF;

  SELECT count(*) INTO pool_size FROM public.vip_pass_pool WHERE active = true;

  IF pool_size = 0 THEN
    RETURN jsonb_build_object(
      'available', false,
      'reason', 'No VIP passes loaded yet — check back soon.',
      'pool_size', 0
    );
  END IF;

  SELECT * INTO pool_row
    FROM public.vip_pass_pool
   WHERE active = true
   ORDER BY random()
   LIMIT 1;

  expiry := now() + (ttl_secs || ' seconds')::interval;

  INSERT INTO public.vip_pass_reveals (user_id, pool_id, revealed_at, expires_at)
    VALUES (uid, pool_row.id, now(), expiry);

  uname := CASE WHEN pool_row.enc_username IS NULL THEN NULL ELSE extensions.pgp_sym_decrypt(pool_row.enc_username, k)::text END;
  pword := CASE WHEN pool_row.enc_password IS NULL THEN NULL ELSE extensions.pgp_sym_decrypt(pool_row.enc_password, k)::text END;

  RETURN jsonb_build_object(
    'available', true,
    'label', pool_row.label,
    'code', COALESCE(pool_row.code, ''),
    'username', uname,
    'password', pword,
    'revealed_at', now(),
    'expires_at', expiry,
    'expires_in', ttl_secs,
    'pool_size', pool_size
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.boss_list_vip_pass_pool() TO authenticated;
GRANT EXECUTE ON FUNCTION public.boss_upsert_vip_pass_pool(uuid, text, text, boolean, integer, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reveal_vip_pass() TO authenticated;