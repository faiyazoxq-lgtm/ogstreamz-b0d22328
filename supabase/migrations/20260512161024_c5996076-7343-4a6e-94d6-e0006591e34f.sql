-- Tighten realtime publication scope for tables flagged by the security scan.
-- Goal: stop Realtime from broadcasting fields/rows that authenticated subscribers
-- shouldn't see, even though row-level SELECT policies on the base tables are
-- intentionally permissive.

-- 1) battlehub_votes: only publish round_key + side. Drop user_id and visitor_id
--    from the wire so realtime subscribers cannot reconstruct who voted for what.
ALTER PUBLICATION supabase_realtime DROP TABLE public.battlehub_votes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.battlehub_votes (round_key, side);

-- 2) custom_hubs: only publish rows that are already published AND publicly
--    visible. Draft hubs and signed_in/private hubs no longer leak via realtime.
ALTER PUBLICATION supabase_realtime DROP TABLE public.custom_hubs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.custom_hubs
  WHERE (published = true AND visibility = 'public');

-- market_pulse and store_settings are intentionally world-readable
-- (price ticker + global pricing config) and are left in the publication as-is.