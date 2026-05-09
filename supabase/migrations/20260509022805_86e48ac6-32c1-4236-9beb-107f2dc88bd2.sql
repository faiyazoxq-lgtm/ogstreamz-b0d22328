-- Lock down SECURITY DEFINER functions: revoke from PUBLIC/anon, grant only where needed.

-- Trigger-only / server-only (no client EXECUTE needed)
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_credit_purchase(uuid, text, text, integer, integer, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_pending_grants(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refresh_news_scout(text, jsonb) FROM PUBLIC, anon, authenticated;

-- Helper predicates used inside RLS / SQL only
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_boss(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.plan_includes_tier(subscription_plan, subscription_plan) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_active_vip(uuid, text) FROM PUBLIC, anon;

-- Authenticated-only RPCs (revoke from anon, keep authenticated)
REVOKE EXECUTE ON FUNCTION public.spend_credits(integer, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.redeem_code(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.claim_signup_pass(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.request_topup(integer, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.apply_trade_scan(text, text, text, integer, jsonb, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.reseller_mint_code(text, integer, integer, integer) FROM PUBLIC, anon;

-- Boss/admin-only RPCs (internal auth check, but no need to expose to anon)
REVOKE EXECUTE ON FUNCTION public.boss_topup_reseller(uuid, integer, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.boss_revoke_vip_pass(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.boss_create_reseller(uuid, text, integer, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.boss_grant_by_email(text, integer, syndicate_rank, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.boss_grant_vip_pass(uuid, timestamptz, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.boss_approve_topup(uuid, integer, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.boss_deny_topup(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_adjust_credits(uuid, integer, text) FROM PUBLIC, anon;

-- increment_portal_view stays callable by anon (used on public portal pages)
-- No change.
