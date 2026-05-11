-- Audit table
CREATE TABLE IF NOT EXISTS public.function_exec_audit (
  signature text PRIMARY KEY,
  justification text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'needs_review' CHECK (status IN ('needs_review','justified','revoke')),
  reviewed_by uuid,
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.function_exec_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Boss reads audit"
  ON public.function_exec_audit FOR SELECT
  TO authenticated
  USING (public.is_boss(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Boss writes audit"
  ON public.function_exec_audit FOR ALL
  TO authenticated
  USING (public.is_boss(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.is_boss(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));

-- List every public-schema function and its EXECUTE grants alongside the latest audit note
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
  ORDER BY
    (NOT has_function_privilege('anon', p.oid, 'EXECUTE')),
    p.proname;
$$;

REVOKE EXECUTE ON FUNCTION public.boss_list_exposed_functions() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.boss_list_exposed_functions() TO authenticated;

-- Save / update an audit note for a function
CREATE OR REPLACE FUNCTION public.boss_upsert_function_audit(
  _signature text,
  _justification text,
  _status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.is_boss(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _status NOT IN ('needs_review','justified','revoke') THEN
    RAISE EXCEPTION 'invalid status';
  END IF;

  INSERT INTO public.function_exec_audit (signature, justification, status, reviewed_by, reviewed_at)
  VALUES (_signature, COALESCE(_justification, ''), _status, auth.uid(), now())
  ON CONFLICT (signature)
  DO UPDATE SET
    justification = EXCLUDED.justification,
    status        = EXCLUDED.status,
    reviewed_by   = EXCLUDED.reviewed_by,
    reviewed_at   = now();
END;
$$;

REVOKE EXECUTE ON FUNCTION public.boss_upsert_function_audit(text, text, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.boss_upsert_function_audit(text, text, text) TO authenticated;