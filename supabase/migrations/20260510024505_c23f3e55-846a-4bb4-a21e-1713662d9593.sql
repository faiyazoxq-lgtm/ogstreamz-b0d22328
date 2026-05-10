-- 0G-VAULT credentials pool ----------------------------------------------------

CREATE TABLE IF NOT EXISTS public.vault_credentials (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label       text NOT NULL DEFAULT '',
  username    text NOT NULL,
  password    text NOT NULL,
  active      boolean NOT NULL DEFAULT true,
  sort_order  integer NOT NULL DEFAULT 0,
  created_by  uuid,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vault_credentials_active_sort
  ON public.vault_credentials (active, sort_order, id);

ALTER TABLE public.vault_credentials ENABLE ROW LEVEL SECURITY;

-- Only Boss/admins can read or write this table directly. Members reach
-- the credential exclusively through the security-definer reveal function.
CREATE POLICY "Boss reads vault credentials"
  ON public.vault_credentials
  FOR SELECT
  TO authenticated
  USING (public.is_boss(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Boss writes vault credentials"
  ON public.vault_credentials
  FOR ALL
  TO authenticated
  USING (public.is_boss(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.is_boss(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER vault_credentials_touch
  BEFORE UPDATE ON public.vault_credentials
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Real OG predicate ------------------------------------------------------------
-- Real OG = boss/admin, profiles.status = 'vip', OR an active vip_pass row.
CREATE OR REPLACE FUNCTION public.is_real_og(_uid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    _uid IS NOT NULL
    AND (
      public.is_boss(_uid)
      OR public.has_role(_uid, 'admin'::app_role)
      OR EXISTS (SELECT 1 FROM public.profiles WHERE id = _uid AND status = 'vip')
      OR EXISTS (
        SELECT 1 FROM public.vip_passes
        WHERE user_id = _uid AND revoked_at IS NULL AND expires_at > now()
      )
    );
$$;

-- Reveal function --------------------------------------------------------------
-- Returns the credential for the current 15-minute window. Same window across
-- all Real OGs so the rotation is deterministic and shareable.
CREATE OR REPLACE FUNCTION public.reveal_vault_credential()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid           uuid := auth.uid();
  bucket_secs   bigint := 900;            -- 15 minutes
  bucket_idx    bigint;
  window_start  timestamptz;
  rotates_at    timestamptz;
  total         integer;
  pick          public.vault_credentials;
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
      'available',  false,
      'reason',     'No credentials configured yet — check back soon.',
      'rotates_in', bucket_secs
    );
  END IF;

  bucket_idx   := floor(extract(epoch FROM now()) / bucket_secs)::bigint;
  window_start := to_timestamp(bucket_idx * bucket_secs);
  rotates_at   := window_start + (bucket_secs || ' seconds')::interval;

  -- Deterministically pick row at offset (bucket_idx mod total) from active rows
  -- ordered by sort_order then id, so every Real OG sees the same one in-window.
  SELECT * INTO pick FROM (
    SELECT v.*, row_number() OVER (ORDER BY v.sort_order, v.id) - 1 AS rn
    FROM public.vault_credentials v
    WHERE v.active = true
  ) ranked
  WHERE rn = (bucket_idx % total)
  LIMIT 1;

  RETURN jsonb_build_object(
    'available',     true,
    'label',         pick.label,
    'username',      pick.username,
    'password',      pick.password,
    'window_start',  window_start,
    'rotates_at',    rotates_at,
    'rotates_in',    GREATEST(0, EXTRACT(EPOCH FROM (rotates_at - now()))::int),
    'pool_size',     total
  );
END;
$$;

-- Boss CRUD helpers ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.boss_upsert_vault_credential(
  _id uuid,
  _label text,
  _username text,
  _password text,
  _active boolean,
  _sort_order integer
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  out_id uuid;
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

  IF _id IS NULL THEN
    INSERT INTO public.vault_credentials (label, username, password, active, sort_order, created_by)
      VALUES (COALESCE(_label, ''), trim(_username), trim(_password),
              COALESCE(_active, true), COALESCE(_sort_order, 0), auth.uid())
      RETURNING id INTO out_id;
  ELSE
    UPDATE public.vault_credentials
      SET label = COALESCE(_label, label),
          username = trim(_username),
          password = trim(_password),
          active = COALESCE(_active, active),
          sort_order = COALESCE(_sort_order, sort_order),
          updated_at = now()
      WHERE id = _id
      RETURNING id INTO out_id;
    IF out_id IS NULL THEN RAISE EXCEPTION 'Credential not found'; END IF;
  END IF;
  RETURN out_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.boss_delete_vault_credential(_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.is_boss(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role)) THEN
    RAISE EXCEPTION 'Boss only';
  END IF;
  DELETE FROM public.vault_credentials WHERE id = _id;
  RETURN FOUND;
END;
$$;
