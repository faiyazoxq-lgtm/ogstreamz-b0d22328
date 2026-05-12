-- Restrict anon column exposure on public.portals by routing anon reads through a sanitized view.
-- Creators, authenticated members, boss, and admin paths are unaffected.

DROP POLICY IF EXISTS "Public can view published portals" ON public.portals;

CREATE POLICY "Members can view published portals"
  ON public.portals
  FOR SELECT
  TO authenticated
  USING (published = true);

-- Sanitized public projection. security_invoker=false so the view bypasses RLS;
-- visibility is gated by the WHERE published=true filter and the column whitelist.
CREATE OR REPLACE VIEW public.portals_public
WITH (security_invoker = false) AS
SELECT
  id,
  slug,
  name,
  niche,
  language,
  vibe,
  theme,
  style,
  kind,
  jokes,
  music_hooks,
  trade_briefs,
  connect_openers,
  tool_ideas,
  vip,
  price_cents,
  theme_config,
  scout_meta,
  view_count,
  use_credit_cost,
  swear_chat_enabled,
  audio_snippet_url,
  bg_video_url,
  bg_video_aspect,
  bg_video_prompt,
  audio_url,
  lyric_text,
  seo_title,
  seo_description,
  seo_image_url,
  seo_refreshed_at,
  created_at,
  updated_at,
  -- telegram_config: expose only the public-facing chat link fields,
  -- never any webhook/secret/internal channel id that may be added later.
  CASE
    WHEN telegram_config IS NULL THEN NULL
    ELSE jsonb_strip_nulls(jsonb_build_object(
      'groupLink',   telegram_config->>'groupLink',
      'vipLink',     telegram_config->>'vipLink',
      'botUsername', telegram_config->>'botUsername',
      'brand',       telegram_config->'brand'
    ))
  END AS telegram_config
FROM public.portals
WHERE published = true;

ALTER VIEW public.portals_public OWNER TO postgres;

REVOKE ALL ON public.portals_public FROM PUBLIC;
GRANT SELECT ON public.portals_public TO anon, authenticated;

COMMENT ON VIEW public.portals_public IS
  'Anonymous-safe projection of public.portals. Excludes brief, metadata, paid_services, halalify, and sanitizes telegram_config to public chat-link fields only. Anon role has no SELECT on public.portals; use this view instead.';