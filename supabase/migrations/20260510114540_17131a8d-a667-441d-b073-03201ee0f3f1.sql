-- 1. Extend syndicate_rank enum with 'stream_user' (between enforcer and vip)
ALTER TYPE public.syndicate_rank ADD VALUE IF NOT EXISTS 'stream_user';

-- 2. Add banned + stream credential columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS banned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS banned_at timestamptz,
  ADD COLUMN IF NOT EXISTS banned_reason text,
  ADD COLUMN IF NOT EXISTS stream_username text,
  ADD COLUMN IF NOT EXISTS stream_password text,
  ADD COLUMN IF NOT EXISTS stream_server text,
  ADD COLUMN IF NOT EXISTS stream_status text,
  ADD COLUMN IF NOT EXISTS stream_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS stream_expires_at timestamptz;

-- 3. Boss-only: toggle ban
CREATE OR REPLACE FUNCTION public.boss_set_banned(_user_id uuid, _banned boolean, _reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.is_boss(auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role)) THEN
    RAISE EXCEPTION 'Boss only';
  END IF;
  UPDATE public.profiles
  SET banned = _banned,
      banned_at = CASE WHEN _banned THEN now() ELSE NULL END,
      banned_reason = CASE WHEN _banned THEN _reason ELSE NULL END,
      updated_at = now()
  WHERE id = _user_id;
END;
$$;

-- 4. Member/Boss: upsert stream credentials (members can set their own; Boss can set anyone)
CREATE OR REPLACE FUNCTION public.set_stream_credentials(_user_id uuid, _username text, _password text, _server text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Auth required';
  END IF;
  IF auth.uid() <> _user_id AND NOT (public.is_boss(auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role)) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  UPDATE public.profiles
  SET stream_username = NULLIF(trim(_username), ''),
      stream_password = NULLIF(_password, ''),
      stream_server = NULLIF(trim(_server), ''),
      updated_at = now()
  WHERE id = _user_id;
END;
$$;

-- 5. Mark a profile as stream-verified and auto-promote rank if currently at or below stream tier
CREATE OR REPLACE FUNCTION public.mark_stream_verified(
  _user_id uuid,
  _status text,
  _expires_at timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_rank public.syndicate_rank;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Auth required';
  END IF;
  IF auth.uid() <> _user_id AND NOT (public.is_boss(auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role)) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  SELECT rank INTO current_rank FROM public.profiles WHERE id = _user_id;

  UPDATE public.profiles
  SET stream_status = _status,
      stream_verified_at = now(),
      stream_expires_at = _expires_at,
      rank = CASE
        WHEN _status = 'Active' AND current_rank IN ('prospect','enforcer') THEN 'stream_user'::public.syndicate_rank
        ELSE current_rank
      END,
      updated_at = now()
  WHERE id = _user_id;
END;
$$;