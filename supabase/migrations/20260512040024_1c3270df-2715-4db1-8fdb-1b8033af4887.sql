
CREATE OR REPLACE FUNCTION public.boss_list_exposed_functions()
RETURNS TABLE (
  schema_name text,
  function_name text,
  arguments text,
  signature text,
  security_definer boolean,
  anon_can_execute boolean,
  authenticated_can_execute boolean,
  public_can_execute boolean,
  justification text,
  status text,
  reviewed_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT ON (signature)
    schema_name,
    function_name,
    arguments,
    signature,
    security_definer,
    anon_can_execute,
    authenticated_can_execute,
    public_can_execute,
    justification,
    status,
    reviewed_at
  FROM (
    SELECT
      n.nspname::text                                                    AS schema_name,
      p.proname::text                                                    AS function_name,
      pg_get_function_identity_arguments(p.oid)                          AS arguments,
      (n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')') AS signature,
      p.prosecdef                                                        AS security_definer,
      has_function_privilege('anon',          p.oid, 'EXECUTE')          AS anon_can_execute,
      has_function_privilege('authenticated', p.oid, 'EXECUTE')          AS authenticated_can_execute,
      has_function_privilege('public',        p.oid, 'EXECUTE')          AS public_can_execute,
      COALESCE(a.justification, '')                                      AS justification,
      COALESCE(a.status, 'needs_review')                                 AS status,
      a.reviewed_at
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    LEFT JOIN public.function_exec_audit a
      ON a.signature = (n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')')
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND (
        has_function_privilege('anon',          p.oid, 'EXECUTE')
        OR has_function_privilege('authenticated', p.oid, 'EXECUTE')
        OR has_function_privilege('public',        p.oid, 'EXECUTE')
      )
      AND (public.is_boss(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role))
  ) src
  ORDER BY signature, (NOT anon_can_execute), function_name;
$$;

REVOKE EXECUTE ON FUNCTION public.boss_list_exposed_functions() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.boss_list_exposed_functions() TO authenticated;

-- Deduped count of SECURITY DEFINER functions exposed via PostgREST grants.
CREATE OR REPLACE FUNCTION public.boss_definer_signature_count()
RETURNS TABLE (
  total_definer integer,
  anon_definer integer,
  authenticated_definer integer,
  public_definer integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH defs AS (
    SELECT DISTINCT
      (n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')') AS signature,
      has_function_privilege('anon',          p.oid, 'EXECUTE') AS anon_x,
      has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_x,
      has_function_privilege('public',        p.oid, 'EXECUTE') AS pub_x
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND p.prosecdef
      AND (
        has_function_privilege('anon',          p.oid, 'EXECUTE')
        OR has_function_privilege('authenticated', p.oid, 'EXECUTE')
        OR has_function_privilege('public',        p.oid, 'EXECUTE')
      )
  )
  SELECT
    COUNT(*)::int AS total_definer,
    COUNT(*) FILTER (WHERE anon_x)::int AS anon_definer,
    COUNT(*) FILTER (WHERE auth_x)::int AS authenticated_definer,
    COUNT(*) FILTER (WHERE pub_x)::int  AS public_definer
  FROM defs
  WHERE (public.is_boss(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));
$$;

REVOKE EXECUTE ON FUNCTION public.boss_definer_signature_count() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.boss_definer_signature_count() TO authenticated;
