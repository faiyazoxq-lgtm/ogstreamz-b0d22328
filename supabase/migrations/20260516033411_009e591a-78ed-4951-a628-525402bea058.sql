-- 1. payments_settings: restrict SELECT to authenticated users only
DROP POLICY IF EXISTS "payments_settings readable to all" ON public.payments_settings;

CREATE POLICY "payments_settings readable to authenticated"
ON public.payments_settings
FOR SELECT
TO authenticated
USING (true);

-- 2. realtime.messages: add a RESTRICTIVE policy that blocks cross-user
--    scoped postgres_changes topics. The existing permissive "Scoped
--    postgres_changes subscriptions" policy already allows the user's own
--    UUID-suffixed topic; this RESTRICTIVE policy guarantees that any
--    topic starting with a user-scoped prefix MUST end with the caller's
--    own auth.uid(), regardless of how the permissive policy is evaluated.
DROP POLICY IF EXISTS "Block cross-user scoped postgres_changes" ON realtime.messages;

CREATE POLICY "Block cross-user scoped postgres_changes"
ON realtime.messages
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (
  extension <> 'postgres_changes'
  OR (
    -- For each scoped prefix, either the topic doesn't start with that
    -- prefix at all, or it equals the caller's own UUID-suffixed form.
    (realtime.topic() NOT LIKE 'suno-jobs-%'          OR realtime.topic() = ('suno-jobs-'         || auth.uid()::text))
    AND (realtime.topic() NOT LIKE 'power-packs-%'        OR realtime.topic() = ('power-packs-'       || auth.uid()::text))
    AND (realtime.topic() NOT LIKE 'power_packs-%'        OR realtime.topic() = ('power_packs-'       || auth.uid()::text))
    AND (realtime.topic() NOT LIKE 'vip-notifications-%'  OR realtime.topic() = ('vip-notifications-' || auth.uid()::text))
    AND (realtime.topic() NOT LIKE 'vip_notifications-%'  OR realtime.topic() = ('vip_notifications-' || auth.uid()::text))
    AND (realtime.topic() NOT LIKE 'wallet:%'             OR realtime.topic() = ('wallet:'            || auth.uid()::text))
    AND (realtime.topic() NOT LIKE 'sub_%'                OR realtime.topic() = ('sub_'               || auth.uid()::text))
    AND (realtime.topic() NOT LIKE 'musichub-balance-%'   OR realtime.topic() = ('musichub-balance-'  || auth.uid()::text))
    AND (realtime.topic() NOT LIKE 'track-purchases-%'    OR realtime.topic() = ('track-purchases-'   || auth.uid()::text))
  )
);