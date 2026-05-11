DROP POLICY IF EXISTS "Public reads safe track columns" ON public.tracks;

-- Ensure the safe-columns view is the only public-facing read surface.
GRANT SELECT ON public.tracks_public TO anon, authenticated;