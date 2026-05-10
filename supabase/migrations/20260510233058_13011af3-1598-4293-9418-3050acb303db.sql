
-- Encrypted Boss-only vault for AI agent / integration API keys.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Reuse stream link key as the symmetric secret (already singleton, RLS-locked).
-- If you want a separate key, swap `_stream_link_secret()` for a dedicated one.

CREATE TABLE IF NOT EXISTS public.agent_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key_name text NOT NULL UNIQUE,
  label text NOT NULL DEFAULT '',
  agent_group text NOT NULL DEFAULT 'general',
  description text NOT NULL DEFAULT '',
  enc_value bytea NOT NULL,
  last_set_by uuid,
  last_set_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_api_keys ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.agent_api_keys FROM PUBLIC, anon, authenticated;
-- No RLS policies — only SECURITY DEFINER helpers below can touch this table.

-- Re-use existing stream-link symmetric key
-- (already private and RLS-locked; only SECURITY DEFINER fns can read it).

-- ============================================================================
-- LIST keys (metadata only, no values)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.boss_list_agent_keys()
RETURNS TABLE(
  id uuid,
  key_name text,
  label text,
  agent_group text,
  description text,
  has_value boolean,
  preview text,
  last_set_by uuid,
  last_set_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE k text;
BEGIN
  IF NOT (public.is_boss(auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role)) THEN
    RAISE EXCEPTION 'Boss only';
  END IF;

  k := public._stream_link_secret();

  RETURN QUERY
  SELECT
    a.id,
    a.key_name,
    a.label,
    a.agent_group,
    a.description,
    (length(a.enc_value) > 0) AS has_value,
    -- Last 4 chars only, for confirmation. Never the full value.
    CASE
      WHEN length(a.enc_value) > 0
      THEN '••••' || right(pgp_sym_decrypt(a.enc_value, k)::text, 4)
      ELSE ''
    END AS preview,
    a.last_set_by,
    a.last_set_at,
    a.updated_at
  FROM public.agent_api_keys a
  ORDER BY a.agent_group, a.key_name;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.boss_list_agent_keys() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.boss_list_agent_keys() TO authenticated;

-- ============================================================================
-- UPSERT a key (creates or replaces value + metadata)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.boss_upsert_agent_key(
  _key_name text,
  _value text,
  _label text DEFAULT NULL,
  _agent_group text DEFAULT NULL,
  _description text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE k text; out_id uuid;
BEGIN
  IF NOT (public.is_boss(auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role)) THEN
    RAISE EXCEPTION 'Boss only';
  END IF;

  IF _key_name IS NULL OR length(trim(_key_name)) = 0 THEN
    RAISE EXCEPTION 'key_name required';
  END IF;
  IF length(_key_name) > 120 THEN
    RAISE EXCEPTION 'key_name too long';
  END IF;
  IF _value IS NULL OR length(_value) = 0 THEN
    RAISE EXCEPTION 'value required';
  END IF;
  IF length(_value) > 8192 THEN
    RAISE EXCEPTION 'value too long';
  END IF;

  k := public._stream_link_secret();

  INSERT INTO public.agent_api_keys
    (key_name, label, agent_group, description, enc_value, last_set_by, last_set_at, updated_at)
  VALUES
    (_key_name,
     COALESCE(_label, _key_name),
     COALESCE(_agent_group, 'general'),
     COALESCE(_description, ''),
     pgp_sym_encrypt(_value, k),
     auth.uid(),
     now(),
     now())
  ON CONFLICT (key_name) DO UPDATE SET
    enc_value   = pgp_sym_encrypt(_value, k),
    label       = COALESCE(_label, agent_api_keys.label),
    agent_group = COALESCE(_agent_group, agent_api_keys.agent_group),
    description = COALESCE(_description, agent_api_keys.description),
    last_set_by = auth.uid(),
    last_set_at = now(),
    updated_at  = now()
  RETURNING id INTO out_id;

  RETURN out_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.boss_upsert_agent_key(text, text, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.boss_upsert_agent_key(text, text, text, text, text)
  TO authenticated;

-- ============================================================================
-- UPDATE metadata only (no value change)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.boss_update_agent_key_meta(
  _key_name text,
  _label text DEFAULT NULL,
  _agent_group text DEFAULT NULL,
  _description text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.is_boss(auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role)) THEN
    RAISE EXCEPTION 'Boss only';
  END IF;
  UPDATE public.agent_api_keys
  SET
    label       = COALESCE(_label, label),
    agent_group = COALESCE(_agent_group, agent_group),
    description = COALESCE(_description, description),
    updated_at  = now()
  WHERE key_name = _key_name;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.boss_update_agent_key_meta(text, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.boss_update_agent_key_meta(text, text, text, text)
  TO authenticated;

-- ============================================================================
-- DELETE
-- ============================================================================
CREATE OR REPLACE FUNCTION public.boss_delete_agent_key(_key_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.is_boss(auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role)) THEN
    RAISE EXCEPTION 'Boss only';
  END IF;
  DELETE FROM public.agent_api_keys WHERE key_name = _key_name;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.boss_delete_agent_key(text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.boss_delete_agent_key(text)
  TO authenticated;

-- ============================================================================
-- REVEAL — returns plaintext, audited via last_set_at on read? No, separate audit.
-- Used only when Boss explicitly clicks "reveal".
-- ============================================================================
CREATE OR REPLACE FUNCTION public.boss_reveal_agent_key(_key_name text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE k text; v text;
BEGIN
  IF NOT (public.is_boss(auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role)) THEN
    RAISE EXCEPTION 'Boss only';
  END IF;
  k := public._stream_link_secret();
  SELECT pgp_sym_decrypt(enc_value, k)::text INTO v
  FROM public.agent_api_keys WHERE key_name = _key_name;
  RETURN v;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.boss_reveal_agent_key(text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.boss_reveal_agent_key(text)
  TO authenticated;
