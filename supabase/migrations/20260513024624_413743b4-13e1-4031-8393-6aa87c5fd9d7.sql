
-- 1) Track last sync time per todo (used for last-write-wins reconciliation).
ALTER TABLE public.boss_todos
  ADD COLUMN IF NOT EXISTS synced_at timestamptz NULL;

-- 2) Boss-wide settings (singleton row enforced by unique partial index).
CREATE TABLE IF NOT EXISTS public.boss_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton boolean NOT NULL DEFAULT true,
  gsheet_id text,
  gsheet_url text,
  gsheet_last_pull_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enforce single row.
CREATE UNIQUE INDEX IF NOT EXISTS boss_settings_singleton_idx
  ON public.boss_settings (singleton);

ALTER TABLE public.boss_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "boss_settings admin read"   ON public.boss_settings;
DROP POLICY IF EXISTS "boss_settings admin insert" ON public.boss_settings;
DROP POLICY IF EXISTS "boss_settings admin update" ON public.boss_settings;
DROP POLICY IF EXISTS "boss_settings admin delete" ON public.boss_settings;

CREATE POLICY "boss_settings admin read"
  ON public.boss_settings FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "boss_settings admin insert"
  ON public.boss_settings FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "boss_settings admin update"
  ON public.boss_settings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "boss_settings admin delete"
  ON public.boss_settings FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- updated_at trigger reuses the existing helper.
DROP TRIGGER IF EXISTS trg_boss_settings_updated ON public.boss_settings;
CREATE TRIGGER trg_boss_settings_updated
  BEFORE UPDATE ON public.boss_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
