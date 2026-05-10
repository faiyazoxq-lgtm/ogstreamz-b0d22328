-- Revoke EXECUTE from anon on sensitive SECURITY DEFINER functions (defense in depth on top of in-function auth checks)
DO $$
DECLARE
  fn record;
  keep text[] := ARRAY[
    'increment_portal_view',
    'get_action_billing',
    'get_signup_bonus_credits',
    'is_real_og',
    'civility_default',
    'has_role',
    'is_boss',
    'has_active_vip',
    'plan_includes_tier'
  ];
BEGIN
  FOR fn IN
    SELECT p.oid, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND NOT (p.proname = ANY(keep))
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM anon, public', fn.proname, fn.args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated', fn.proname, fn.args);
  END LOOP;
END $$;