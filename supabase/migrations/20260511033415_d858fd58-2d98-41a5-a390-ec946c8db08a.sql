DROP POLICY IF EXISTS "Anon insert view events" ON public.portal_view_events;
DROP POLICY IF EXISTS "Auth insert view events" ON public.portal_view_events;

CREATE POLICY "Anon insert view events"
ON public.portal_view_events
FOR INSERT
TO anon
WITH CHECK (
  kind IN ('portal','battle')
  AND length(slug) BETWEEN 1 AND 128
  AND (visitor_id IS NULL OR length(visitor_id) <= 128)
  AND (referrer IS NULL OR length(referrer) <= 2048)
  AND (user_agent IS NULL OR length(user_agent) <= 1024)
  AND (path IS NULL OR length(path) <= 2048)
  AND (country IS NULL OR length(country) <= 8)
);

CREATE POLICY "Auth insert view events"
ON public.portal_view_events
FOR INSERT
TO authenticated
WITH CHECK (
  kind IN ('portal','battle')
  AND length(slug) BETWEEN 1 AND 128
  AND (visitor_id IS NULL OR length(visitor_id) <= 128)
  AND (referrer IS NULL OR length(referrer) <= 2048)
  AND (user_agent IS NULL OR length(user_agent) <= 1024)
  AND (path IS NULL OR length(path) <= 2048)
  AND (country IS NULL OR length(country) <= 8)
);