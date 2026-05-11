-- Drop the over-permissive public SELECT policy
DROP POLICY IF EXISTS "Anyone view tracks" ON public.tracks;

-- Revoke broad table-level grants from anon/authenticated
REVOKE ALL ON public.tracks FROM anon, authenticated;

-- Owners can read their own full row (including sensitive columns)
CREATE POLICY "Owners read own tracks"
ON public.tracks
FOR SELECT
TO authenticated
USING (auth.uid() = created_by);

-- Re-grant column-scoped SELECT (excluding full_path, suno_prompt)
GRANT SELECT (id, portal_slug, title, preview_path, price_cents, currency, created_by, created_at, updated_at)
  ON public.tracks TO anon, authenticated;

-- Public-safe view for anonymous browsing
CREATE OR REPLACE VIEW public.tracks_public
WITH (security_invoker = true) AS
SELECT id, portal_slug, title, preview_path, price_cents, currency, created_by, created_at, updated_at
FROM public.tracks;

GRANT SELECT ON public.tracks_public TO anon, authenticated;

-- The view needs a permissive SELECT policy on the underlying table for anon
CREATE POLICY "Public reads safe track columns"
ON public.tracks
FOR SELECT
TO anon, authenticated
USING (true);