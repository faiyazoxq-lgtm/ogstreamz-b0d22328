
-- 1. Schema: add encrypted username/password, allow code to be optional
ALTER TABLE public.vip_pass_pool
  ADD COLUMN IF NOT EXISTS enc_username bytea,
  ADD COLUMN IF NOT EXISTS enc_password bytea,
  ALTER COLUMN code DROP NOT NULL,
  ALTER COLUMN code SET DEFAULT '';

-- 2. Replace upsert RPC to accept username + password
CREATE OR REPLACE FUNCTION public.boss_upsert_vip_pass_pool(
  _id uuid,
  _label text,
  _code text,
  _active boolean,
  _sort_order integer,
  _username text DEFAULT NULL,
  _password text DEFAULT NULL
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

  -- Require at least a code, OR both a username and password
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
      CASE WHEN has_user THEN pgp_sym_encrypt(trim(_username), k) ELSE NULL END,
      CASE WHEN has_pass THEN pgp_sym_encrypt(trim(_password), k) ELSE NULL END,
      COALESCE(_active, true),
      COALESCE(_sort_order, 0),
      auth.uid()
    )
    RETURNING id INTO out_id;
  ELSE
    UPDATE public.vip_pass_pool
       SET label        = COALESCE(_label, label),
           code         = CASE WHEN has_code THEN trim(_code) ELSE code END,
           enc_username = CASE WHEN has_user THEN pgp_sym_encrypt(trim(_username), k) ELSE enc_username END,
           enc_password = CASE WHEN has_pass THEN pgp_sym_encrypt(trim(_password), k) ELSE enc_password END,
           active       = COALESCE(_active, active),
           sort_order   = COALESCE(_sort_order, sort_order),
           updated_at   = now()
     WHERE id = _id
     RETURNING id INTO out_id;
    IF out_id IS NULL THEN RAISE EXCEPTION 'Pass not found'; END IF;
  END IF;
  RETURN out_id;
END;
$function$;

-- 3. Boss-only list with decrypted username/password
CREATE OR REPLACE FUNCTION public.boss_list_vip_pass_pool()
RETURNS TABLE(
  id uuid,
  label text,
  code text,
  username text,
  password text,
  active boolean,
  sort_order integer,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE k text;
BEGIN
  IF NOT (public.is_boss(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role)) THEN
    RAISE EXCEPTION 'Boss only';
  END IF;
  k := public._stream_link_secret();
  RETURN QUERY
    SELECT v.id, v.label, COALESCE(v.code, '')::text,
           CASE WHEN v.enc_username IS NULL THEN ''::text ELSE pgp_sym_decrypt(v.enc_username, k)::text END,
           CASE WHEN v.enc_password IS NULL THEN ''::text ELSE pgp_sym_decrypt(v.enc_password, k)::text END,
           v.active, v.sort_order, v.created_at, v.updated_at
    FROM public.vip_pass_pool v
    ORDER BY v.sort_order ASC, v.created_at ASC;
END;
$function$;

-- 4. Update reveal_vip_pass to also return decrypted username/password
CREATE OR REPLACE FUNCTION public.reveal_vip_pass()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  uid uuid := auth.uid();
  cur public.vip_pass_reveals;
  pool_row public.vip_pass_pool;
  pool_size int;
  ttl_secs int := 900;
  expiry timestamptz;
  k text;
  uname text;
  pword text;
begin
  if uid is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if not public.is_real_og(uid) then
    raise exception 'Real OG / VIP pass required' using errcode = '42501';
  end if;

  k := public._stream_link_secret();

  select r.* into cur
    from public.vip_pass_reveals r
    join public.vip_pass_pool p on p.id = r.pool_id
   where r.user_id = uid
     and r.expires_at > now()
     and p.active = true
   order by r.revealed_at desc
   limit 1;

  if cur.id is not null then
    select * into pool_row from public.vip_pass_pool where id = cur.pool_id;
    select count(*) into pool_size from public.vip_pass_pool where active = true;
    uname := CASE WHEN pool_row.enc_username IS NULL THEN NULL ELSE pgp_sym_decrypt(pool_row.enc_username, k)::text END;
    pword := CASE WHEN pool_row.enc_password IS NULL THEN NULL ELSE pgp_sym_decrypt(pool_row.enc_password, k)::text END;
    return jsonb_build_object(
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
  end if;

  select count(*) into pool_size from public.vip_pass_pool where active = true;
  if pool_size = 0 then
    return jsonb_build_object(
      'available', false,
      'reason', 'No VIP passes loaded yet — check back soon.',
      'pool_size', 0
    );
  end if;

  select * into pool_row
    from public.vip_pass_pool
   where active = true
   order by random()
   limit 1;

  expiry := now() + (ttl_secs || ' seconds')::interval;

  insert into public.vip_pass_reveals (user_id, pool_id, revealed_at, expires_at)
    values (uid, pool_row.id, now(), expiry);

  uname := CASE WHEN pool_row.enc_username IS NULL THEN NULL ELSE pgp_sym_decrypt(pool_row.enc_username, k)::text END;
  pword := CASE WHEN pool_row.enc_password IS NULL THEN NULL ELSE pgp_sym_decrypt(pool_row.enc_password, k)::text END;

  return jsonb_build_object(
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
end;
$function$;
