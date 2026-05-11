REVOKE EXECUTE ON FUNCTION public.increment_portal_view(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_portal_view(text) TO service_role;