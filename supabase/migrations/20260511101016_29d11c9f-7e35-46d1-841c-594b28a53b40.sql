REVOKE EXECUTE ON FUNCTION public.boss_list_function_grant_log() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.boss_restore_function_execute(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.boss_revoke_function_execute(text, text, text) FROM anon, PUBLIC;