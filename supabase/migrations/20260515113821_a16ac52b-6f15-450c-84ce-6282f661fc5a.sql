CREATE TABLE IF NOT EXISTS public.reseller_admin_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL CHECK (action IN ('create','topup')),
  actor_user_id uuid NOT NULL,
  target_user_id uuid NOT NULL,
  reseller_id uuid,
  delta integer,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reseller_admin_audit_target
  ON public.reseller_admin_audit (target_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reseller_admin_audit_actor
  ON public.reseller_admin_audit (actor_user_id, created_at DESC);

ALTER TABLE public.reseller_admin_audit ENABLE ROW LEVEL SECURITY;
-- No policies: only service_role (which bypasses RLS) can read/write.
-- The audit log is written by boss-only server functions via supabaseAdmin
-- and read by future boss-only audit views (also via supabaseAdmin).