
CREATE TABLE public.signup_passes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text UNIQUE NOT NULL,
  label text,
  redeem_code text,
  credits integer NOT NULL DEFAULT 0,
  vip_days integer,
  max_uses integer NOT NULL DEFAULT 1,
  uses integer NOT NULL DEFAULT 0,
  expires_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_signup_passes_token ON public.signup_passes(token);

CREATE TABLE public.signup_pass_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pass_id uuid NOT NULL REFERENCES public.signup_passes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pass_id, user_id)
);

ALTER TABLE public.signup_passes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signup_pass_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Boss manages signup passes" ON public.signup_passes
  FOR ALL TO authenticated USING (public.is_boss(auth.uid())) WITH CHECK (public.is_boss(auth.uid()));

CREATE POLICY "Boss views all claims" ON public.signup_pass_claims
  FOR SELECT TO authenticated USING (public.is_boss(auth.uid()));
CREATE POLICY "Members view own claims" ON public.signup_pass_claims
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.claim_signup_pass(_token text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  p public.signup_passes;
  rc public.redeem_codes;
  granted_credits integer := 0;
  vip_until timestamptz;
  already int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO p FROM public.signup_passes WHERE token = upper(trim(_token)) FOR UPDATE;
  IF p.id IS NULL THEN RAISE EXCEPTION 'Invalid pass'; END IF;
  IF p.expires_at IS NOT NULL AND p.expires_at < now() THEN RAISE EXCEPTION 'Pass expired'; END IF;
  IF p.uses >= p.max_uses THEN RAISE EXCEPTION 'Pass fully used'; END IF;

  SELECT count(*) INTO already FROM public.signup_pass_claims WHERE pass_id = p.id AND user_id = uid;
  IF already > 0 THEN RAISE EXCEPTION 'Already claimed'; END IF;

  IF COALESCE(p.credits, 0) > 0 THEN
    UPDATE public.profiles SET credits = credits + p.credits, updated_at = now() WHERE id = uid;
    INSERT INTO public.credit_ledger (user_id, delta, reason) VALUES (uid, p.credits, 'pass:' || p.token);
    granted_credits := p.credits;
  END IF;

  IF COALESCE(p.vip_days, 0) > 0 THEN
    vip_until := now() + (p.vip_days || ' days')::interval;
    INSERT INTO public.vip_passes (user_id, granted_by, source, notes, expires_at)
      VALUES (uid, p.created_by, 'pass:' || p.token, p.label, vip_until);
    UPDATE public.profiles
      SET status = 'vip'::account_status,
          rank = CASE WHEN rank = 'boss'::syndicate_rank THEN rank ELSE 'vip'::syndicate_rank END,
          updated_at = now()
      WHERE id = uid;
  END IF;

  IF p.redeem_code IS NOT NULL AND length(p.redeem_code) > 0 THEN
    SELECT * INTO rc FROM public.redeem_codes WHERE code = upper(trim(p.redeem_code)) FOR UPDATE;
    IF rc.id IS NOT NULL
       AND (rc.expires_at IS NULL OR rc.expires_at > now())
       AND rc.uses < rc.max_uses
       AND NOT EXISTS (SELECT 1 FROM public.redemptions WHERE user_id = uid AND code_id = rc.id)
    THEN
      INSERT INTO public.redemptions (user_id, code_id, credits_granted, rank_granted)
        VALUES (uid, rc.id, rc.credits, rc.grant_rank);
      UPDATE public.redeem_codes SET uses = uses + 1 WHERE id = rc.id;
      UPDATE public.profiles
        SET credits = credits + rc.credits,
            rank = COALESCE(rc.grant_rank, rank),
            status = CASE WHEN rc.grant_rank IN ('vip','boss') THEN 'vip'::account_status ELSE status END,
            updated_at = now()
        WHERE id = uid;
      INSERT INTO public.credit_ledger (user_id, delta, reason) VALUES (uid, rc.credits, 'redeem:' || rc.code);
      granted_credits := granted_credits + rc.credits;
    END IF;
  END IF;

  INSERT INTO public.signup_pass_claims (pass_id, user_id) VALUES (p.id, uid);
  UPDATE public.signup_passes SET uses = uses + 1 WHERE id = p.id;

  RETURN jsonb_build_object('credits', granted_credits, 'vip_until', vip_until, 'label', p.label);
END $$;
