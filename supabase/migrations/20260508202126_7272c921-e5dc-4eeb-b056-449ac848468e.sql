REVOKE ALL ON FUNCTION public.redeem_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_code(text) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_adjust_credits(uuid, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_adjust_credits(uuid, integer, text) TO authenticated;