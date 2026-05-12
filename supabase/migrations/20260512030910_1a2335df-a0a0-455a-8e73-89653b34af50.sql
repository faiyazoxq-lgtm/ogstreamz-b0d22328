-- Revoke read access to internal-only portal columns from unauthenticated (anon) clients.
-- These columns aren't used by any public-facing page; they hold strategy/brief data
-- and editor configuration that only signed-in admins/boss should see.
REVOKE SELECT (
  bg_video_prompt,
  brief,
  brief_version,
  brief_updated_at,
  halalify,
  metadata
) ON public.portals FROM anon;

-- Make sure authenticated roles still have full SELECT (covers admins and the
-- portal editor surfaces). This is a no-op if the grant already exists.
GRANT SELECT ON public.portals TO authenticated;