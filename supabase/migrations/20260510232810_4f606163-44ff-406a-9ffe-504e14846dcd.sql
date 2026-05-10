
-- Helper RPCs for the Boss publish-readiness checklist.
-- Both are SECURITY DEFINER so they can read pg_catalog regardless of caller,
-- but EXECUTE is revoked from anon/authenticated and only granted to service_role
-- (the publish-check server fn uses the service-role admin client).

CREATE OR REPLACE FUNCTION public.publish_check_rls_status()
RETURNS TABLE(table_name text, rls_enabled boolean)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_catalog
AS $$
  SELECT c.relname::text AS table_name, c.relrowsecurity AS rls_enabled
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
  ORDER BY c.relname;
$$;

CREATE OR REPLACE FUNCTION public.publish_check_policy_counts()
RETURNS TABLE(table_name text, policy_count bigint)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_catalog
AS $$
  SELECT c.relname::text AS table_name,
         COUNT(p.polname) AS policy_count
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  LEFT JOIN pg_policy p ON p.polrelid = c.oid
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
    AND c.relrowsecurity = true
  GROUP BY c.relname
  ORDER BY c.relname;
$$;

REVOKE ALL ON FUNCTION public.publish_check_rls_status() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.publish_check_policy_counts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.publish_check_rls_status() TO service_role;
GRANT EXECUTE ON FUNCTION public.publish_check_policy_counts() TO service_role;
