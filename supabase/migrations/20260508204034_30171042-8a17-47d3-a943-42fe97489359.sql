
ALTER TABLE public.portals
  ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS audio_snippet_url text;

CREATE OR REPLACE FUNCTION public.increment_portal_view(_slug text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_count integer;
BEGIN
  UPDATE public.portals
    SET view_count = view_count + 1
    WHERE slug = _slug
    RETURNING view_count INTO new_count;
  RETURN COALESCE(new_count, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_portal_view(text) TO anon, authenticated;
