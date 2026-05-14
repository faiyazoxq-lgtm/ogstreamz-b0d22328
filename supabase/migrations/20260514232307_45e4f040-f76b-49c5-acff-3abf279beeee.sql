-- Tighten profile self-update WITH CHECK guard: also lock down
-- referred_by_reseller and any privileged feature_flags keys
-- (everything except user-controllable swearing/chaos toggles).
CREATE OR REPLACE FUNCTION public._profile_self_update_safe(
  _id uuid,
  _rank syndicate_rank,
  _status account_status,
  _credits integer,
  _subscription_plan subscription_plan,
  _banned boolean,
  _referred_by_reseller uuid DEFAULT NULL,
  _feature_flags jsonb DEFAULT '{}'::jsonb
)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
      FROM public.profiles p
     WHERE p.id = _id
       AND p.rank              IS NOT DISTINCT FROM _rank
       AND p.status            IS NOT DISTINCT FROM _status
       AND p.credits           IS NOT DISTINCT FROM _credits
       AND p.subscription_plan IS NOT DISTINCT FROM _subscription_plan
       AND p.banned            IS NOT DISTINCT FROM _banned
       AND p.referred_by_reseller IS NOT DISTINCT FROM _referred_by_reseller
       AND (
         (COALESCE(p.feature_flags,'{}'::jsonb)
            - 'swearing' - 'swearing_intensity' - 'chaos_mode')
         IS NOT DISTINCT FROM
         (COALESCE(_feature_flags,'{}'::jsonb)
            - 'swearing' - 'swearing_intensity' - 'chaos_mode')
       )
  );
$function$;

-- Replace the policy to use the new signature
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND public._profile_self_update_safe(
      id, rank, status, credits, subscription_plan, banned,
      referred_by_reseller, feature_flags
    )
  );