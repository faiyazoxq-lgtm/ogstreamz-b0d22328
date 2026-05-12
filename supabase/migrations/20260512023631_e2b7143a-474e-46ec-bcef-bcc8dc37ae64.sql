-- Defense-in-depth: revoke column-level SELECT on internal portal columns
-- from anon and authenticated roles. RLS still permits SELECT on the row,
-- but PostgREST will block these specific columns when queried by the
-- public anon key or a signed-in user's JWT. Service role (used inside
-- our boss/admin server functions) retains full access.

REVOKE SELECT (brief, brief_version, brief_updated_at, bg_video_prompt, metadata)
  ON public.portals FROM anon, authenticated;

-- Make sure service role keeps every privilege it had.
GRANT SELECT ON public.portals TO service_role;