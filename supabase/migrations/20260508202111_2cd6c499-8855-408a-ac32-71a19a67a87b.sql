-- Rank enum
DO $$ BEGIN
  CREATE TYPE public.syndicate_rank AS ENUM ('prospect','enforcer','vip','boss');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Profile additions
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS rank public.syndicate_rank NOT NULL DEFAULT 'prospect',
  ADD COLUMN IF NOT EXISTS feature_flags jsonb NOT NULL DEFAULT '{"jokes":true,"music":true,"tools":true}'::jsonb,
  ADD COLUMN IF NOT EXISTS free_clicks_used integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS display_name text;

-- Update handle_new_user to set rank + boss for founder
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, credits, status, rank)
  VALUES (
    NEW.id,
    NEW.email,
    CASE WHEN NEW.email = 'faiyazoxq@gmail.com' THEN 9999 ELSE 5 END,
    CASE WHEN NEW.email = 'faiyazoxq@gmail.com' THEN 'vip' ELSE 'free' END,
    CASE WHEN NEW.email = 'faiyazoxq@gmail.com' THEN 'boss'::public.syndicate_rank ELSE 'prospect'::public.syndicate_rank END
  )
  ON CONFLICT (id) DO NOTHING;

  IF NEW.email = 'faiyazoxq@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
    ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ Redeem codes ============
CREATE TABLE IF NOT EXISTS public.redeem_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  credits integer NOT NULL CHECK (credits > 0),
  grant_rank public.syndicate_rank,
  max_uses integer NOT NULL DEFAULT 1 CHECK (max_uses > 0),
  uses integer NOT NULL DEFAULT 0,
  expires_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.redeem_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage redeem codes" ON public.redeem_codes;
CREATE POLICY "Admins manage redeem codes" ON public.redeem_codes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  code_id uuid NOT NULL REFERENCES public.redeem_codes(id) ON DELETE CASCADE,
  credits_granted integer NOT NULL,
  rank_granted public.syndicate_rank,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, code_id)
);
ALTER TABLE public.redemptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members view own redemptions" ON public.redemptions;
CREATE POLICY "Members view own redemptions" ON public.redemptions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admins view all redemptions" ON public.redemptions;
CREATE POLICY "Admins view all redemptions" ON public.redemptions
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- Redeem function: validates code, applies credits + optional rank, dedupes per user
CREATE OR REPLACE FUNCTION public.redeem_code(_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  rc public.redeem_codes;
  already int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO rc FROM public.redeem_codes WHERE code = upper(trim(_code)) FOR UPDATE;
  IF rc.id IS NULL THEN RAISE EXCEPTION 'Invalid code'; END IF;
  IF rc.expires_at IS NOT NULL AND rc.expires_at < now() THEN RAISE EXCEPTION 'Code expired'; END IF;
  IF rc.uses >= rc.max_uses THEN RAISE EXCEPTION 'Code fully redeemed'; END IF;

  SELECT count(*) INTO already FROM public.redemptions WHERE user_id = uid AND code_id = rc.id;
  IF already > 0 THEN RAISE EXCEPTION 'You already redeemed this code'; END IF;

  INSERT INTO public.redemptions (user_id, code_id, credits_granted, rank_granted)
    VALUES (uid, rc.id, rc.credits, rc.grant_rank);

  UPDATE public.redeem_codes SET uses = uses + 1 WHERE id = rc.id;

  UPDATE public.profiles
    SET credits = credits + rc.credits,
        rank = COALESCE(rc.grant_rank, rank),
        status = CASE WHEN rc.grant_rank IN ('vip','boss') THEN 'vip'::account_status ELSE status END,
        updated_at = now()
    WHERE id = uid;

  INSERT INTO public.credit_ledger (user_id, delta, reason)
    VALUES (uid, rc.credits, 'redeem:' || rc.code);

  RETURN jsonb_build_object('credits', rc.credits, 'rank', rc.grant_rank);
END;
$$;

-- Admin: adjust credits + log
CREATE OR REPLACE FUNCTION public.admin_adjust_credits(_user_id uuid, _delta integer, _reason text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_balance integer;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admin only'; END IF;
  UPDATE public.profiles SET credits = GREATEST(0, credits + _delta), updated_at = now()
    WHERE id = _user_id RETURNING credits INTO new_balance;
  IF new_balance IS NULL THEN RAISE EXCEPTION 'User not found'; END IF;
  INSERT INTO public.credit_ledger (user_id, delta, reason)
    VALUES (_user_id, _delta, COALESCE(_reason, 'admin:adjust'));
  RETURN new_balance;
END;
$$;

-- Bump existing founder to boss if exists
UPDATE public.profiles SET rank = 'boss', status='vip'
  WHERE email = 'faiyazoxq@gmail.com' AND rank <> 'boss';