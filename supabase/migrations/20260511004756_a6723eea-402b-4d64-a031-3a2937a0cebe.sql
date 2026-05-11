CREATE TABLE IF NOT EXISTS public.domain_denylist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain text NOT NULL UNIQUE,
  note text NOT NULL DEFAULT '',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.domain_denylist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public reads denylist"
  ON public.domain_denylist FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Boss writes denylist"
  ON public.domain_denylist FOR ALL
  TO authenticated
  USING (is_boss(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (is_boss(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_domain_denylist_domain ON public.domain_denylist (domain);

-- normalise domain on insert/update (lowercase, strip scheme/path/port)
CREATE OR REPLACE FUNCTION public.normalize_denylist_domain()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.domain := lower(trim(NEW.domain));
  NEW.domain := regexp_replace(NEW.domain, '^https?://', '');
  NEW.domain := regexp_replace(NEW.domain, '/.*$', '');
  NEW.domain := regexp_replace(NEW.domain, ':\d+$', '');
  NEW.domain := regexp_replace(NEW.domain, '^www\.', '');
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_denylist_domain ON public.domain_denylist;
CREATE TRIGGER trg_normalize_denylist_domain
  BEFORE INSERT OR UPDATE ON public.domain_denylist
  FOR EACH ROW EXECUTE FUNCTION public.normalize_denylist_domain();