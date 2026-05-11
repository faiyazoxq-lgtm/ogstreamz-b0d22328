-- Remove sensitive cross-user tables from supabase_realtime publication.
-- Realtime postgres_changes broadcasts ALL row changes to every authenticated
-- subscriber (RLS on the source table is bypassed for broadcast). Keeping
-- profiles, credit_ledger, track_purchases, hub_settings, pass_orders in the
-- publication leaks PII, financial data and admin config to anyone with a
-- session. Listeners that previously relied on realtime have been switched
-- to short-interval polling.
ALTER PUBLICATION supabase_realtime DROP TABLE public.profiles;
ALTER PUBLICATION supabase_realtime DROP TABLE public.credit_ledger;
ALTER PUBLICATION supabase_realtime DROP TABLE public.track_purchases;
ALTER PUBLICATION supabase_realtime DROP TABLE public.hub_settings;
ALTER PUBLICATION supabase_realtime DROP TABLE public.pass_orders;