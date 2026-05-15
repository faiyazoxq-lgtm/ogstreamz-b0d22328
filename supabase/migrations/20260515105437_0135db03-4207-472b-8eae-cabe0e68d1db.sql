DROP FUNCTION IF EXISTS public._profile_self_update_safe(uuid, syndicate_rank, account_status, integer, subscription_plan, boolean);

ALTER FUNCTION public._lifetime_vip_expiry() SET search_path = public;