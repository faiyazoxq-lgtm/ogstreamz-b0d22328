-- 1) Add encrypted columns
ALTER TABLE public.vault_credentials
  ADD COLUMN IF NOT EXISTS enc_username bytea,
  ADD COLUMN IF NOT EXISTS enc_password bytea;

-- 2) Migrate any existing plain-text rows (table is currently empty but be safe)
DO $$
DECLARE k text;
BEGIN
  k := public._stream_link_secret();
  UPDATE public.vault_credentials
     SET enc_username = pgp_sym_encrypt(COALESCE(username,''), k),
         enc_password = pgp_sym_encrypt(COALESCE(password,''), k)
   WHERE enc_username IS NULL OR enc_password IS NULL;
END $$;

-- 3) Drop old plain-text columns
ALTER TABLE public.vault_credentials DROP COLUMN IF EXISTS username;
ALTER TABLE public.vault_credentials DROP COLUMN IF EXISTS password;

-- 4) Make encrypted columns required
ALTER TABLE public.vault_credentials
  ALTER COLUMN enc_username SET NOT NULL,
  ALTER COLUMN enc_password SET NOT NULL;

-- 5) Replace upsert function: encrypt on write
CREATE OR REPLACE FUNCTION public.boss_upsert_vault_credential(
  _id uuid, _label text, _username text, _password text,
  _active boolean, _sort_order integer
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  out_id uuid;
  k text;
BEGIN
  IF NOT (public.is_boss(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role)) THEN
    RAISE EXCEPTION 'Boss only';
  END IF;
  IF _username IS NULL OR length(trim(_username)) = 0 THEN
    RAISE EXCEPTION 'Username required';
  END IF;
  IF _password IS NULL OR length(trim(_password)) = 0 THEN
    RAISE EXCEPTION 'Password required';
  END IF;

  k := public._stream_link_secret();

  IF _id IS NULL THEN
    INSERT INTO public.vault_credentials
      (label, enc_username, enc_password, active, sort_order, created_by)
      VALUES (
        COALESCE(_label, ''),
        pgp_sym_encrypt(trim(_username), k),
        pgp_sym_encrypt(trim(_password), k),
        COALESCE(_active, true),
        COALESCE(_sort_order, 0),
        auth.uid()
      )
      RETURNING id INTO out_id;
  ELSE
    UPDATE public.vault_credentials
      SET label        = COALESCE(_label, label),
          enc_username = pgp_sym_encrypt(trim(_username), k),
          enc_password = pgp_sym_encrypt(trim(_password), k),
          active       = COALESCE(_active, active),
          sort_order   = COALESCE(_sort_order, sort_order),
          updated_at   = now()
      WHERE id = _id
      RETURNING id INTO out_id;
    IF out_id IS NULL THEN RAISE EXCEPTION 'Credential not found'; END IF;
  END IF;
  RETURN out_id;
END;
$function$;

-- 6) Replace reveal function: decrypt on read
CREATE OR REPLACE FUNCTION public.reveal_vault_credential()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  uid           uuid := auth.uid();
  bucket_secs   bigint := 900;
  bucket_idx    bigint;
  window_start  timestamptz;
  rotates_at    timestamptz;
  total         integer;
  pick          public.vault_credentials;
  k             text;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_real_og(uid) THEN
    RAISE EXCEPTION 'Real OG pass required' USING ERRCODE = '42501';
  END IF;

  SELECT count(*) INTO total FROM public.vault_credentials WHERE active = true;
  IF total = 0 THEN
    RETURN jsonb_build_object(
      'available', false,
      'reason', 'No credentials configured yet — check back soon.',
      'rotates_in', bucket_secs
    );
  END IF;

  bucket_idx   := floor(extract(epoch FROM now()) / bucket_secs)::bigint;
  window_start := to_timestamp(bucket_idx * bucket_secs);
  rotates_at   := window_start + (bucket_secs || ' seconds')::interval;

  SELECT * INTO pick FROM (
    SELECT v.*, row_number() OVER (ORDER BY v.sort_order, v.id) - 1 AS rn
    FROM public.vault_credentials v
    WHERE v.active = true
  ) ranked
  WHERE rn = (bucket_idx % total)
  LIMIT 1;

  k := public._stream_link_secret();

  RETURN jsonb_build_object(
    'available',    true,
    'label',        pick.label,
    'username',     pgp_sym_decrypt(pick.enc_username, k)::text,
    'password',     pgp_sym_decrypt(pick.enc_password, k)::text,
    'window_start', window_start,
    'rotates_at',   rotates_at,
    'rotates_in',   GREATEST(0, EXTRACT(EPOCH FROM (rotates_at - now()))::int),
    'pool_size',    total
  );
END;
$function$;

-- 7) Boss-only listing function (decrypts server-side so the UI never selects plaintext columns)
CREATE OR REPLACE FUNCTION public.boss_list_vault_credentials()
RETURNS TABLE(
  id uuid, label text, username text, password text,
  active boolean, sort_order integer,
  created_at timestamptz, updated_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE k text;
BEGIN
  IF NOT (public.is_boss(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role)) THEN
    RAISE EXCEPTION 'Boss only';
  END IF;
  k := public._stream_link_secret();
  RETURN QUERY
    SELECT v.id, v.label,
           pgp_sym_decrypt(v.enc_username, k)::text,
           pgp_sym_decrypt(v.enc_password, k)::text,
           v.active, v.sort_order, v.created_at, v.updated_at
    FROM public.vault_credentials v
    ORDER BY v.sort_order ASC, v.created_at ASC;
END;
$function$;