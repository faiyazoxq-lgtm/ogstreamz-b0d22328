-- VIP referral codes + redemption ledger
-- Each VIP profile gets a unique 6-digit numeric code. New signups (within 7 days)
-- can redeem one code; both the referrer and the new user receive 2 credits.

-- 1. Schema
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referral_code text;

-- Numeric-6 format, unique when present
CREATE UNIQUE INDEX IF NOT EXISTS profiles_referral_code_uniq
  ON public.profiles (referral_code)
  WHERE referral_code IS NOT NULL;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_referral_code_format;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_referral_code_format
  CHECK (referral_code IS NULL OR referral_code ~ '^[0-9]{6}$');

-- 2. Helper: generate a unique 6-digit code (avoids leading-zero collisions)
CREATE OR REPLACE FUNCTION public.gen_unique_referral_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  candidate text;
  tries int := 0;
BEGIN
  LOOP
    candidate := lpad((floor(random() * 1000000))::int::text, 6, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE referral_code = candidate);
    tries := tries + 1;
    IF tries > 50 THEN
      RAISE EXCEPTION 'Could not allocate a unique referral code';
    END IF;
  END LOOP;
  RETURN candidate;
END $$;

-- 3. Trigger: auto-assign code when a profile becomes VIP (or any time it has none and is VIP)
CREATE OR REPLACE FUNCTION public.assign_referral_code_on_vip()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'vip' AND (NEW.referral_code IS NULL OR NEW.referral_code = '') THEN
    NEW.referral_code := public.gen_unique_referral_code();
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_profiles_assign_referral_code ON public.profiles;
CREATE TRIGGER trg_profiles_assign_referral_code
  BEFORE INSERT OR UPDATE OF status ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.assign_referral_code_on_vip();

-- 4. Backfill existing VIPs
UPDATE public.profiles
SET referral_code = public.gen_unique_referral_code()
WHERE status = 'vip' AND (referral_code IS NULL OR referral_code = '');

-- 5. Redemption ledger
CREATE TABLE IF NOT EXISTS public.referral_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL,
  new_user_id uuid NOT NULL UNIQUE,
  code text NOT NULL,
  credits_each integer NOT NULL DEFAULT 2,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.referral_redemptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members read own redemptions" ON public.referral_redemptions;
CREATE POLICY "Members read own redemptions"
  ON public.referral_redemptions FOR SELECT
  TO authenticated
  USING (auth.uid() = referrer_id OR auth.uid() = new_user_id);

DROP POLICY IF EXISTS "Boss reads all redemptions" ON public.referral_redemptions;
CREATE POLICY "Boss reads all redemptions"
  ON public.referral_redemptions FOR SELECT
  TO authenticated
  USING (public.is_boss(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));

-- (No INSERT/UPDATE/DELETE policies — only the SECURITY DEFINER claim fn writes.)

CREATE INDEX IF NOT EXISTS referral_redemptions_referrer_idx
  ON public.referral_redemptions (referrer_id, created_at DESC);

-- 6. Claim function — called by the new user (or by handle_new_user on their behalf)
CREATE OR REPLACE FUNCTION public.claim_vip_referral(p_code text, p_user_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user        uuid := COALESCE(p_user_id, auth.uid());
  v_referrer    uuid;
  v_new_profile public.profiles%ROWTYPE;
  v_credits     int := 2;
  v_clean       text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  -- Normalise: keep only digits, must be exactly 6
  v_clean := regexp_replace(COALESCE(p_code, ''), '[^0-9]', '', 'g');
  IF length(v_clean) <> 6 THEN
    RAISE EXCEPTION 'Referral code must be 6 digits';
  END IF;

  SELECT id INTO v_referrer
  FROM public.profiles
  WHERE referral_code = v_clean AND status = 'vip'
  LIMIT 1;

  IF v_referrer IS NULL THEN
    RAISE EXCEPTION 'Referral code not recognised';
  END IF;

  IF v_referrer = v_user THEN
    RAISE EXCEPTION 'You cannot redeem your own code';
  END IF;

  SELECT * INTO v_new_profile FROM public.profiles WHERE id = v_user;
  IF v_new_profile.id IS NULL THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  -- One redemption per new user, only within first 7 days of signup
  IF EXISTS (SELECT 1 FROM public.referral_redemptions WHERE new_user_id = v_user) THEN
    RAISE EXCEPTION 'You have already redeemed a referral code';
  END IF;

  IF v_new_profile.created_at < now() - interval '7 days' THEN
    RAISE EXCEPTION 'Referral codes can only be redeemed within 7 days of signup';
  END IF;

  -- Award credits to both sides
  UPDATE public.profiles SET credits = credits + v_credits, updated_at = now()
   WHERE id IN (v_user, v_referrer);

  INSERT INTO public.credit_ledger (user_id, delta, reason) VALUES
    (v_user,     v_credits, 'referral_redeemed:' || v_clean),
    (v_referrer, v_credits, 'referral_credit:' || v_clean);

  INSERT INTO public.referral_redemptions (referrer_id, new_user_id, code, credits_each)
  VALUES (v_referrer, v_user, v_clean, v_credits);

  RETURN jsonb_build_object(
    'ok', true,
    'credits_awarded', v_credits,
    'referrer_id', v_referrer
  );
END $$;

REVOKE ALL ON FUNCTION public.claim_vip_referral(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_vip_referral(text, uuid) TO authenticated;

-- 7. Hook into handle_new_user to auto-claim if signup metadata carries vip_ref
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ref_id    uuid;
  bonus     integer := public.get_signup_bonus_credits();
  vip_code  text;
BEGIN
  BEGIN
    ref_id := NULLIF(NEW.raw_user_meta_data->>'referred_by_reseller','')::uuid;
  EXCEPTION WHEN others THEN ref_id := NULL;
  END;

  vip_code := NULLIF(regexp_replace(COALESCE(NEW.raw_user_meta_data->>'vip_referral_code',''), '[^0-9]', '', 'g'), '');

  INSERT INTO public.profiles (id, email, credits, status, rank, referred_by_reseller)
  VALUES (NEW.id, NEW.email, bonus, 'free', 'prospect'::public.syndicate_rank, ref_id)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT DO NOTHING;

  PERFORM public.apply_pending_grants(NEW.id, NEW.email);

  IF vip_code IS NOT NULL AND length(vip_code) = 6 THEN
    BEGIN
      PERFORM public.claim_vip_referral(vip_code, NEW.id);
    EXCEPTION WHEN others THEN
      -- swallow: invalid code shouldn't block signup
      NULL;
    END;
  END IF;

  RETURN NEW;
END $$;