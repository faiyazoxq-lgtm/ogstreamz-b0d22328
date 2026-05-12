-- Add explicit RLS policies for stream_url_tokens.
-- This table is managed exclusively by the server (service role) for short-lived
-- signed stream URL tokens. Clients should only ever be able to see their own
-- non-revoked tokens (read), and never insert/update/delete directly.

-- Users can read their own tokens (useful for debugging / "active sessions" UI).
CREATE POLICY "Users can view own stream url tokens"
  ON public.stream_url_tokens
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Boss / admin can read all tokens for support.
CREATE POLICY "Boss can view all stream url tokens"
  ON public.stream_url_tokens
  FOR SELECT
  TO authenticated
  USING (public.is_boss(auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role));

-- No INSERT / UPDATE / DELETE policies are defined: all writes must go through
-- server functions using the service-role client, which bypasses RLS.