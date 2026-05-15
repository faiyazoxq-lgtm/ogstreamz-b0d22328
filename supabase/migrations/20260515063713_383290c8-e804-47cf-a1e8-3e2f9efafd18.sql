-- Full lockdown of every boss_* function in the public schema.
-- After this migration, only service_role can EXECUTE these. Authenticated /
-- anon / PUBLIC are revoked. App admin flows MUST go through TanStack server
-- functions gated by requireBoss + supabaseAdmin.

DO $$
DECLARE
  fn record;
  sig text;
BEGIN
  FOR fn IN
    SELECT
      n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname LIKE 'boss\_%'
  LOOP
    sig := fn.sig;
    BEGIN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', sig);
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', sig);
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', sig);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', sig);
      RAISE NOTICE 'Locked down: %', sig;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Skipped (error on %): %', sig, SQLERRM;
    END;
  END LOOP;
END
$$;