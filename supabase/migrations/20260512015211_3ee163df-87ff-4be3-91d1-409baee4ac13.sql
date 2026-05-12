-- Extend custom_hubs with slug, description, visibility, template, sections
ALTER TABLE public.custom_hubs
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS template text NOT NULL DEFAULT 'generic',
  ADD COLUMN IF NOT EXISTS sections jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Constrain visibility values
DO $$ BEGIN
  ALTER TABLE public.custom_hubs
    ADD CONSTRAINT custom_hubs_visibility_check
    CHECK (visibility IN ('public','signed_in','boss_only'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Slug format: lowercase letters, numbers, hyphens. Optional (nullable) so
-- hubs that link to existing routes (e.g. /music) don't need one.
DO $$ BEGIN
  ALTER TABLE public.custom_hubs
    ADD CONSTRAINT custom_hubs_slug_format_check
    CHECK (slug IS NULL OR slug ~ '^[a-z0-9][a-z0-9-]{1,46}[a-z0-9]$');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS custom_hubs_slug_unique
  ON public.custom_hubs (slug) WHERE slug IS NOT NULL;

-- Tighten viewing rules: drop the old "public read published" policy and
-- replace with three policies honoring visibility.
DROP POLICY IF EXISTS "Public read published hubs" ON public.custom_hubs;

CREATE POLICY "Anyone reads public hubs"
  ON public.custom_hubs FOR SELECT
  USING (published = true AND visibility = 'public');

CREATE POLICY "Signed-in reads signed-in hubs"
  ON public.custom_hubs FOR SELECT
  TO authenticated
  USING (published = true AND visibility IN ('public','signed_in'));

CREATE POLICY "Boss reads everything"
  ON public.custom_hubs FOR SELECT
  TO authenticated
  USING (public.is_boss(auth.uid()));