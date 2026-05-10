-- 1) Columns on portals
ALTER TABLE public.portals
  ADD COLUMN IF NOT EXISTS brief jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS brief_version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS brief_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS halalify jsonb NOT NULL DEFAULT '{"enabled": false}'::jsonb,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_portals_brief        ON public.portals USING gin (brief);
CREATE INDEX IF NOT EXISTS idx_portals_halalify     ON public.portals USING gin (halalify);
CREATE INDEX IF NOT EXISTS idx_portals_metadata     ON public.portals USING gin (metadata);

-- 2) History table
CREATE TABLE IF NOT EXISTS public.portal_brief_versions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_id       uuid NOT NULL REFERENCES public.portals(id) ON DELETE CASCADE,
  version         integer NOT NULL,
  brief           jsonb NOT NULL,
  halalify        jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  edited_by       uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (portal_id, version)
);

CREATE INDEX IF NOT EXISTS idx_portal_brief_versions_portal
  ON public.portal_brief_versions (portal_id, version DESC);

ALTER TABLE public.portal_brief_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view brief versions"   ON public.portal_brief_versions;
DROP POLICY IF EXISTS "Boss/admin manage brief versions" ON public.portal_brief_versions;

CREATE POLICY "Anyone can view brief versions"
  ON public.portal_brief_versions
  FOR SELECT
  USING (true);

CREATE POLICY "Boss/admin manage brief versions"
  ON public.portal_brief_versions
  FOR ALL
  TO authenticated
  USING (public.is_boss(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.is_boss(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));

-- 3) Trigger: snapshot previous brief + bump version
CREATE OR REPLACE FUNCTION public.tg_portal_brief_versioning()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND (NEW.brief    IS DISTINCT FROM OLD.brief
       OR NEW.halalify IS DISTINCT FROM OLD.halalify
       OR NEW.metadata IS DISTINCT FROM OLD.metadata)
  THEN
    -- snapshot the OLD revision into history
    INSERT INTO public.portal_brief_versions
      (portal_id, version, brief, halalify, metadata, edited_by)
    VALUES
      (OLD.id, COALESCE(OLD.brief_version, 1),
       COALESCE(OLD.brief, '{}'::jsonb),
       COALESCE(OLD.halalify, '{}'::jsonb),
       COALESCE(OLD.metadata, '{}'::jsonb),
       auth.uid());

    NEW.brief_version    := COALESCE(OLD.brief_version, 1) + 1;
    NEW.brief_updated_at := now();
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS portals_brief_versioning ON public.portals;
CREATE TRIGGER portals_brief_versioning
  BEFORE UPDATE ON public.portals
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_portal_brief_versioning();