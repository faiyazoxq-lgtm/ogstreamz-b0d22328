ALTER TABLE public.custom_hubs REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.custom_hubs;