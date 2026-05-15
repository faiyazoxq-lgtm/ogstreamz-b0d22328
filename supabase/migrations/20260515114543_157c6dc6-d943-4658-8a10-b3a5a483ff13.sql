-- Audit retention: move reseller_admin_audit rows older than 90 days into an archive table.
-- Archive table mirrors the source schema, RLS on with NO policies (service-role only).

CREATE TABLE IF NOT EXISTS public.reseller_admin_audit_archive (
  id uuid PRIMARY KEY,
  action text NOT NULL,
  actor_user_id uuid,
  target_user_id uuid,
  reseller_id uuid,
  delta integer,
  reason text,
  created_at timestamptz NOT NULL,
  archived_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.reseller_admin_audit_archive ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS reseller_admin_audit_archive_created_at_idx
  ON public.reseller_admin_audit_archive (created_at DESC);
CREATE INDEX IF NOT EXISTS reseller_admin_audit_archive_target_user_id_idx
  ON public.reseller_admin_audit_archive (target_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS reseller_admin_audit_archive_actor_user_id_idx
  ON public.reseller_admin_audit_archive (actor_user_id, created_at DESC);

-- Retention function: archives rows older than _retention_days (default 90) and
-- returns the number of rows moved. SECURITY DEFINER so pg_cron (postgres role)
-- can run it; locked to service_role + postgres for direct calls.
CREATE OR REPLACE FUNCTION public.archive_reseller_admin_audit(_retention_days integer DEFAULT 90)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  moved_count integer;
BEGIN
  WITH cutoff AS (
    SELECT now() - make_interval(days => GREATEST(_retention_days, 1)) AS ts
  ),
  deleted AS (
    DELETE FROM public.reseller_admin_audit a
    USING cutoff c
    WHERE a.created_at < c.ts
    RETURNING a.*
  ),
  inserted AS (
    INSERT INTO public.reseller_admin_audit_archive
      (id, action, actor_user_id, target_user_id, reseller_id, delta, reason, created_at)
    SELECT id, action, actor_user_id, target_user_id, reseller_id, delta, reason, created_at
    FROM deleted
    ON CONFLICT (id) DO NOTHING
    RETURNING 1
  )
  SELECT count(*)::int INTO moved_count FROM inserted;

  RETURN COALESCE(moved_count, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.archive_reseller_admin_audit(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.archive_reseller_admin_audit(integer) TO service_role;