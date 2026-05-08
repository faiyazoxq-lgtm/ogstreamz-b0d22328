-- Public RPC to update a news portal's scout_meta (articles, headline, bias, scanned_at).
-- Restricted to portals where kind='news' so it can't be abused to overwrite other portal types.

CREATE OR REPLACE FUNCTION public.refresh_news_scout(_slug text, _meta jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.portals
     SET scout_meta = _meta,
         updated_at = now()
   WHERE slug = _slug
     AND kind = 'news';
END;
$$;

GRANT EXECUTE ON FUNCTION public.refresh_news_scout(text, jsonb) TO anon, authenticated;