REVOKE EXECUTE ON FUNCTION public.boss_list_vip_pass_pool() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.boss_upsert_vip_pass_pool(uuid, text, text, boolean, integer, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.reveal_vip_pass() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.boss_list_vip_pass_pool() TO authenticated;
GRANT EXECUTE ON FUNCTION public.boss_upsert_vip_pass_pool(uuid, text, text, boolean, integer, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reveal_vip_pass() TO authenticated;