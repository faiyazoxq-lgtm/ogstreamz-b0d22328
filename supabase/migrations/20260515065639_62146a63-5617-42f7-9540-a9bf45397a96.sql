CREATE OR REPLACE FUNCTION public.boss_lockdown_audit()
RETURNS TABLE(
  schema text,
  name text,
  args text,
  anon_execute boolean,
  auth_execute boolean,
  service_role_execute boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT
    n.nspname::text AS schema,
    p.proname::text AS name,
    pg_get_function_identity_arguments(p.oid) AS args,
    has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
    has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_execute,
    has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_role_execute
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND (p.proname LIKE 'boss\_%' ESCAPE '\'
         OR p.proname LIKE 'admin\_%' ESCAPE '\');
$$;

REVOKE EXECUTE ON FUNCTION public.boss_lockdown_audit() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.boss_lockdown_audit() TO service_role;