-- Helper used by the profiles UPDATE WITH CHECK to compare the new row's
-- privileged fields against the existing row, without recursing through RLS.
CREATE OR REPLACE FUNCTION public._profile_self_update_safe(
  _id uuid,
  _rank public.syndicate_rank,
  _status public.account_status,
  _credits integer,
  _subscription_plan public.subscription_plan,
  _banned boolean
) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.profiles p
     WHERE p.id = _id
       AND p.rank              IS NOT DISTINCT FROM _rank
       AND p.status            IS NOT DISTINCT FROM _status
       AND p.credits           IS NOT DISTINCT FROM _credits
       AND p.subscription_plan IS NOT DISTINCT FROM _subscription_plan
       AND p.banned            IS NOT DISTINCT FROM _banned
  );
$$;

REVOKE ALL ON FUNCTION public._profile_self_update_safe(uuid, public.syndicate_rank, public.account_status, integer, public.subscription_plan, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public._profile_self_update_safe(uuid, public.syndicate_rank, public.account_status, integer, public.subscription_plan, boolean) TO authenticated;

-- Replace permissive WITH CHECK on the self-update policy
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  AND public._profile_self_update_safe(id, rank, status, credits, subscription_plan, banned)
);