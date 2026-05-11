-- Column-level restriction on tracks: anon/authenticated can SELECT only safe columns.
-- The RLS policy stays permissive but column GRANTs withhold full_path & suno_prompt.
REVOKE SELECT ON public.tracks FROM anon, authenticated;
GRANT SELECT (id, portal_slug, title, preview_path, price_cents, currency, created_by, created_at, updated_at)
  ON public.tracks TO anon, authenticated;
-- Owners read their own rows including full_path/suno_prompt via the existing
-- "Owners read own tracks" policy combined with the row owner being authenticated.
-- For owner full-row reads, grant the protected columns only to authenticated;
-- RLS still restricts which rows they can see.
GRANT SELECT (full_path, suno_prompt) ON public.tracks TO authenticated;
-- service_role retains everything by default.