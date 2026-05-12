
-- ============================================================
-- 1) battlehub_votes: drop public SELECT, expose aggregates only
-- ============================================================
DROP POLICY IF EXISTS "Public read battlehub votes" ON public.battlehub_votes;

-- Allow voters to see their own row (so realtime/refetch of their pick still works
-- when authenticated). Anonymous voters use the RPC below.
CREATE POLICY "Voters read own battlehub vote"
  ON public.battlehub_votes
  FOR SELECT
  TO authenticated
  USING (user_id IS NOT NULL AND user_id = auth.uid());

-- Aggregate counts for a round (no PII leakage).
CREATE OR REPLACE FUNCTION public.get_battlehub_vote_counts(_round_key bigint)
RETURNS TABLE (side text, votes bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT side, count(*)::bigint
  FROM public.battlehub_votes
  WHERE round_key = _round_key
  GROUP BY side;
$$;
GRANT EXECUTE ON FUNCTION public.get_battlehub_vote_counts(bigint) TO anon, authenticated;

-- "Have I voted?" check — accepts a visitor id for anon callers; for authenticated
-- callers we also match auth.uid().
CREATE OR REPLACE FUNCTION public.get_my_battlehub_vote(_round_key bigint, _visitor_id text)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT side
  FROM public.battlehub_votes
  WHERE round_key = _round_key
    AND (
      (auth.uid() IS NOT NULL AND user_id = auth.uid())
      OR (_visitor_id IS NOT NULL AND visitor_id = _visitor_id)
    )
  ORDER BY created_at DESC
  LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_my_battlehub_vote(bigint, text) TO anon, authenticated;

-- ============================================================
-- 2) portals: hide unpublished drafts from the public
-- ============================================================
DROP POLICY IF EXISTS "Anyone can view portals" ON public.portals;

CREATE POLICY "Public can view published portals"
  ON public.portals
  FOR SELECT
  TO anon, authenticated
  USING (published = true);

CREATE POLICY "Creators can view their own portals"
  ON public.portals
  FOR SELECT
  TO authenticated
  USING (created_by IS NOT NULL AND created_by = auth.uid());

-- ============================================================
-- 3) form_submissions: tighten anon INSERT to published form portals
-- ============================================================
DROP POLICY IF EXISTS "Anyone can submit to a form portal" ON public.form_submissions;

CREATE POLICY "Anyone can submit to a published form portal"
  ON public.form_submissions
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.portals p
      WHERE p.id = form_submissions.portal_id
        AND p.kind = 'form'
        AND p.published = true
    )
  );
