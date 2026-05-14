-- Add wallpaper columns to portals and expose via portals_public
ALTER TABLE public.portals
  ADD COLUMN IF NOT EXISTS wallpaper_url text,
  ADD COLUMN IF NOT EXISTS wallpaper_prompt text;

CREATE OR REPLACE VIEW public.portals_public AS
SELECT id,
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
    CASE
        WHEN telegram_config IS NULL THEN NULL::jsonb
        ELSE jsonb_strip_nulls(jsonb_build_object(
          'groupLink', telegram_config ->> 'groupLink',
          'vipLink', telegram_config ->> 'vipLink',
          'botUsername', telegram_config ->> 'botUsername',
          'brand', telegram_config -> 'brand'))
    END AS telegram_config,
    wallpaper_url,
    wallpaper_prompt
FROM public.portals
WHERE published = true;