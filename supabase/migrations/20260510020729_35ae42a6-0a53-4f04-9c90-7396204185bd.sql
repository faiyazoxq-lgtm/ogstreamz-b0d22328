
-- BattleHUB realtime votes
CREATE TABLE IF NOT EXISTS public.battlehub_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_key bigint NOT NULL,
  side text NOT NULL CHECK (side IN ('gold','shadow')),
  user_id uuid,
  visitor_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (round_key, visitor_id)
);

CREATE INDEX IF NOT EXISTS idx_battlehub_votes_round ON public.battlehub_votes (round_key, side);

ALTER TABLE public.battlehub_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read battlehub votes"
  ON public.battlehub_votes FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anon insert battlehub votes"
  ON public.battlehub_votes FOR INSERT
  TO anon
  WITH CHECK (user_id IS NULL);

CREATE POLICY "Auth insert own battlehub votes"
  ON public.battlehub_votes FOR INSERT
  TO authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

ALTER PUBLICATION supabase_realtime ADD TABLE public.battlehub_votes;
