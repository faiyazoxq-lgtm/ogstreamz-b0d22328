-- Restrict anonymous access to internal-only columns on public.portals.
-- Anonymous users keep read access to public-facing fields only; authenticated
-- users (and the service role) retain full access via existing RLS policies.

REVOKE SELECT ON public.portals FROM anon;

GRANT SELECT (
  id, slug, name, niche, language, vibe, theme, jokes, created_by,
  created_at, updated_at, kind, style, vip, theme_config, scout_meta,
  price_cents, telegram_config, view_count, audio_snippet_url, bg_video_url,
  bg_video_aspect, audio_url, lyric_text, seo_title, seo_description,
  seo_image_url, seo_refreshed_at, swear_chat_enabled, music_hooks,
  trade_briefs, connect_openers, tool_ideas, use_credit_cost
) ON public.portals TO anon;
