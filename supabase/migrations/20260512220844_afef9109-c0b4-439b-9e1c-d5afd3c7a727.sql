-- Stop broadcasting voter identifiers over Realtime.
-- battlehub vote counts are exposed via the get_battlehub_vote_counts RPC (aggregates only).
ALTER PUBLICATION supabase_realtime DROP TABLE public.battlehub_votes;