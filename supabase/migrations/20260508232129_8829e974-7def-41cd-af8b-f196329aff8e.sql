
-- 1. New role
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'reseller';

-- 2. Boss check
CREATE OR REPLACE FUNCTION public.is_boss(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = _uid AND rank = 'boss');
$$;

-- 3. Reseller wallet
CREATE TABLE public.reseller_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  display_name text,
  credits integer NOT NULL DEFAULT 0,
  markup_cents integer NOT NULL DEFAULT 500,
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.reseller_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Boss manages resellers" ON public.reseller_accounts
  FOR ALL TO authenticated USING (public.is_boss(auth.uid())) WITH CHECK (public.is_boss(auth.uid()));
CREATE POLICY "Reseller reads own wallet" ON public.reseller_accounts
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER touch_reseller_accounts BEFORE UPDATE ON public.reseller_accounts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 4. Reseller ledger
CREATE TABLE public.reseller_credit_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_user_id uuid NOT NULL,
  delta integer NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.reseller_credit_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Boss views all reseller ledger" ON public.reseller_credit_ledger
  FOR SELECT TO authenticated USING (public.is_boss(auth.uid()));
CREATE POLICY "Reseller views own ledger" ON public.reseller_credit_ledger
  FOR SELECT TO authenticated USING (auth.uid() = reseller_user_id);

-- 5. Downline + code attribution
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referred_by_reseller uuid;
ALTER TABLE public.redeem_codes ADD COLUMN IF NOT EXISTS reseller_id uuid;
ALTER TABLE public.redeem_codes ADD COLUMN IF NOT EXISTS price_cents integer NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_profiles_referred_by ON public.profiles(referred_by_reseller);
CREATE INDEX IF NOT EXISTS idx_redeem_codes_reseller ON public.redeem_codes(reseller_id);

-- 6. Lock down profiles UPDATE / user_roles to Boss only (admins lose write access)
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
CREATE POLICY "Boss updates any profile" ON public.profiles
  FOR UPDATE TO authenticated USING (public.is_boss(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
CREATE POLICY "Boss manages roles" ON public.user_roles
  FOR ALL TO authenticated USING (public.is_boss(auth.uid())) WITH CHECK (public.is_boss(auth.uid()));

-- Tighten redeem_codes: Boss + owning reseller can manage; admins drop to read-only.
DROP POLICY IF EXISTS "Admins manage redeem codes" ON public.redeem_codes;
CREATE POLICY "Boss manages all codes" ON public.redeem_codes
  FOR ALL TO authenticated USING (public.is_boss(auth.uid())) WITH CHECK (public.is_boss(auth.uid()));
CREATE POLICY "Admins read codes" ON public.redeem_codes
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Resellers manage own codes" ON public.redeem_codes
  FOR ALL TO authenticated
  USING (reseller_id IS NOT NULL AND reseller_id = auth.uid())
  WITH CHECK (reseller_id IS NOT NULL AND reseller_id = auth.uid());

-- 7. Allow resellers to view their downline profiles
CREATE POLICY "Reseller views downline" ON public.profiles
  FOR SELECT TO authenticated
  USING (referred_by_reseller IS NOT NULL AND referred_by_reseller = auth.uid());

-- 8. RPCs
CREATE OR REPLACE FUNCTION public.boss_create_reseller(
  _user_id uuid, _display_name text, _initial_credits integer, _markup_cents integer
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE rid uuid;
BEGIN
  IF NOT public.is_boss(auth.uid()) THEN RAISE EXCEPTION 'Boss only'; END IF;

  INSERT INTO public.reseller_accounts (user_id, display_name, credits, markup_cents, created_by)
    VALUES (_user_id, _display_name, GREATEST(0, COALESCE(_initial_credits,0)), GREATEST(0, COALESCE(_markup_cents,500)), auth.uid())
    ON CONFLICT (user_id) DO UPDATE SET
      display_name = EXCLUDED.display_name,
      markup_cents = EXCLUDED.markup_cents,
      active = true,
      updated_at = now()
    RETURNING id INTO rid;

  INSERT INTO public.user_roles (user_id, role) VALUES (_user_id, 'reseller')
    ON CONFLICT DO NOTHING;

  IF COALESCE(_initial_credits, 0) > 0 THEN
    INSERT INTO public.reseller_credit_ledger (reseller_user_id, delta, reason)
      VALUES (_user_id, _initial_credits, 'boss:initial');
  END IF;
  RETURN rid;
END $$;

CREATE OR REPLACE FUNCTION public.boss_topup_reseller(
  _user_id uuid, _delta integer, _reason text
) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE bal integer;
BEGIN
  IF NOT public.is_boss(auth.uid()) THEN RAISE EXCEPTION 'Boss only'; END IF;
  UPDATE public.reseller_accounts SET credits = GREATEST(0, credits + _delta), updated_at = now()
    WHERE user_id = _user_id RETURNING credits INTO bal;
  IF bal IS NULL THEN RAISE EXCEPTION 'Reseller not found'; END IF;
  INSERT INTO public.reseller_credit_ledger (reseller_user_id, delta, reason)
    VALUES (_user_id, _delta, COALESCE(_reason, 'boss:adjust'));
  RETURN bal;
END $$;

CREATE OR REPLACE FUNCTION public.reseller_mint_code(
  _code text, _credits integer, _max_uses integer, _price_cents integer
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  ra public.reseller_accounts;
  cost integer;
  new_id uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO ra FROM public.reseller_accounts WHERE user_id = uid AND active = true FOR UPDATE;
  IF ra.id IS NULL THEN RAISE EXCEPTION 'Not a reseller'; END IF;

  IF _credits < 1 OR _max_uses < 1 THEN RAISE EXCEPTION 'Invalid amounts'; END IF;
  cost := _credits * _max_uses;
  IF ra.credits < cost THEN RAISE EXCEPTION 'Insufficient wallet (need %, have %)', cost, ra.credits; END IF;

  INSERT INTO public.redeem_codes (code, credits, max_uses, created_by, reseller_id, price_cents)
    VALUES (upper(trim(_code)), _credits, _max_uses, uid, uid, GREATEST(0, COALESCE(_price_cents, 0)))
    RETURNING id INTO new_id;

  UPDATE public.reseller_accounts SET credits = credits - cost, updated_at = now() WHERE user_id = uid;
  INSERT INTO public.reseller_credit_ledger (reseller_user_id, delta, reason)
    VALUES (uid, -cost, 'mint:' || upper(trim(_code)));

  RETURN jsonb_build_object('id', new_id, 'remaining_credits', ra.credits - cost);
END $$;

-- 9. handle_new_user picks up reseller attribution from signup metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  ref_id uuid;
BEGIN
  BEGIN
    ref_id := NULLIF(NEW.raw_user_meta_data->>'referred_by_reseller','')::uuid;
  EXCEPTION WHEN others THEN ref_id := NULL;
  END;

  INSERT INTO public.profiles (id, email, credits, status, rank, referred_by_reseller)
  VALUES (
    NEW.id,
    NEW.email,
    CASE WHEN NEW.email = 'faiyazoxq@gmail.com' THEN 9999 ELSE 5 END,
    CASE WHEN NEW.email = 'faiyazoxq@gmail.com' THEN 'vip' ELSE 'free' END,
    CASE WHEN NEW.email = 'faiyazoxq@gmail.com' THEN 'boss'::public.syndicate_rank ELSE 'prospect'::public.syndicate_rank END,
    ref_id
  )
  ON CONFLICT (id) DO NOTHING;

  IF NEW.email = 'faiyazoxq@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
