-- Unified gallery view of all spawned portals (jokes, music, tools)
CREATE OR REPLACE VIEW public.syndicate_gallery
WITH (security_invoker = true) AS
SELECT
  p.id,
  p.slug,
  p.name,
  COALESCE(p.kind, 'joke') AS kind,             -- 'joke' | 'music'
  p.niche AS description,
  p.language,
  p.vibe,
  p.theme,
  p.theme_config,
  p.vip,
  p.created_at,
  CASE WHEN COALESCE(p.kind,'joke') = 'music' THEN '/m/' || p.slug
       ELSE '/p/' || p.slug END AS path,
  CASE WHEN COALESCE(p.kind,'joke') = 'music' THEN 'music' ELSE 'joke' END AS category
FROM public.portals p
UNION ALL
SELECT
  c.id,
  c.slug,
  c.name,
  'tool'::text AS kind,
  c.description,
  NULL::text AS language,
  NULL::text AS vibe,
  NULL::text AS theme,
  c.config AS theme_config,
  c.vip,
  c.created_at,
  '/t/' || c.slug AS path,
  'tool'::text AS category
FROM public.calculators c
WHERE c.published = true;

GRANT SELECT ON public.syndicate_gallery TO anon, authenticated;