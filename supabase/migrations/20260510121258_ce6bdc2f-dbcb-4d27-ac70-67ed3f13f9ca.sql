REVOKE EXECUTE ON FUNCTION public.notify_user(uuid,text,text,text,text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_stream_expiring_soon() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_stream_request_notify() FROM PUBLIC, anon, authenticated;