-- Lifetime VIP one-time codes
ALTER TABLE public.redeem_codes
  ADD COLUMN IF NOT EXISTS lifetime_vip boolean NOT NULL DEFAULT false;

-- Far-future "lifetime" sentinel
CREATE OR REPLACE FUNCTION public._lifetime_vip_expiry()
RETURNS timestamptz
LANGUAGE sql IMMUTABLE
AS $$ SELECT '2999-12-31 00:00:00+00'::timestamptz $$;

-- Extend redeem_code: if the code is flagged lifetime_vip, also issue a
-- vip_passes row so the Boss can revoke it from the existing dashboard.
CREATE OR REPLACE FUNCTION public.redeem_code(_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  rc public.redeem_codes;
  already int;
  v_pass_id uuid;
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
        rank = COALESCE(
          CASE WHEN rc.lifetime_vip THEN 'vip'::syndicate_rank ELSE rc.grant_rank END,
          rank
        ),
        status = CASE
          WHEN rc.lifetime_vip THEN 'vip'::account_status
          WHEN rc.grant_rank IN ('vip','boss') THEN 'vip'::account_status
          ELSE status
        END,
        updated_at = now()
    WHERE id = uid;

  INSERT INTO public.credit_ledger (user_id, delta, reason)
    VALUES (uid, rc.credits, 'redeem:' || rc.code);

  IF rc.lifetime_vip THEN
    INSERT INTO public.vip_passes (user_id, granted_by, source, notes, expires_at)
    VALUES (
      uid,
      rc.created_by,
      'lifetime_code:' || rc.code,
      'Lifetime VIP via one-time code',
      public._lifetime_vip_expiry()
    )
    RETURNING id INTO v_pass_id;
  END IF;

  RETURN jsonb_build_object(
    'credits', rc.credits,
    'rank', CASE WHEN rc.lifetime_vip THEN 'vip' ELSE rc.grant_rank::text END,
    'lifetime_vip', rc.lifetime_vip,
    'pass_id', v_pass_id
  );
END;
$function$;