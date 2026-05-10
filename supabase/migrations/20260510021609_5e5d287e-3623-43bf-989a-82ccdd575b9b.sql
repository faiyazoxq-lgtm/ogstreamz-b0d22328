ALTER TABLE public.track_purchases REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.track_purchases;