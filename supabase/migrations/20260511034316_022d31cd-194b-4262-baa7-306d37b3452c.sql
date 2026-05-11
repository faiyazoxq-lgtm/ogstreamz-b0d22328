-- 1. Stop public listing of avatars / portals-media buckets
DROP POLICY IF EXISTS "Avatars are publicly readable" ON storage.objects;
DROP POLICY IF EXISTS "Portals media public read"     ON storage.objects;

-- 2. Lock down SECURITY DEFINER functions in public
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', r.sig);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon',   r.sig);
  END LOOP;
END $$;

GRANT EXECUTE ON FUNCTION public.increment_portal_view(text) TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.claim_vip_referral(text, uuid)                 TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_signup_pass(text)                        TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_telegram_link_code(text, bigint, text)   TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_code(text)                              TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_topup(integer, text)                   TO authenticated;
GRANT EXECUTE ON FUNCTION public.purchase_with_coins(text, text)                TO authenticated;
GRANT EXECUTE ON FUNCTION public.peek_portal_download(uuid, integer)            TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_stream_credentials(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_stream_verification(uuid, text, text, text, text, timestamptz, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reveal_vip_pass()                              TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_active_vip(uuid, text)                     TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_real_og(uuid)                               TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role)                TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_boss(uuid)                                  TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_purchases_summary()                   TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_action_billing(text)                       TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_signup_bonus_credits()                     TO authenticated;
GRANT EXECUTE ON FUNCTION public.civility_default()                             TO authenticated;
GRANT EXECUTE ON FUNCTION public.plan_includes_tier(public.subscription_plan, public.subscription_plan) TO authenticated;

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname='public' AND p.prosecdef
       AND p.proname LIKE 'boss\_%' ESCAPE '\'
  LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', r.sig);
  END LOOP;
END $$;