DROP POLICY IF EXISTS "Authenticated postgres_changes subscriptions" ON realtime.messages;

CREATE POLICY "Scoped postgres_changes subscriptions"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  extension = 'postgres_changes'
  AND (
    (
      realtime.topic() NOT LIKE 'suno-jobs-%'
      AND realtime.topic() NOT LIKE 'power-packs-%'
      AND realtime.topic() NOT LIKE 'power_packs-%'
      AND realtime.topic() NOT LIKE 'vip-notifications-%'
      AND realtime.topic() NOT LIKE 'vip_notifications-%'
      AND realtime.topic() NOT LIKE 'wallet:%'
      AND realtime.topic() NOT LIKE 'sub_%'
      AND realtime.topic() NOT LIKE 'musichub-balance-%'
      AND realtime.topic() NOT LIKE 'track-purchases-%'
    )
    OR realtime.topic() = ('suno-jobs-' || auth.uid()::text)
    OR realtime.topic() = ('power-packs-' || auth.uid()::text)
    OR realtime.topic() = ('power_packs-' || auth.uid()::text)
    OR realtime.topic() = ('vip-notifications-' || auth.uid()::text)
    OR realtime.topic() = ('vip_notifications-' || auth.uid()::text)
    OR realtime.topic() = ('wallet:' || auth.uid()::text)
    OR realtime.topic() = ('sub_' || auth.uid()::text)
    OR realtime.topic() = ('musichub-balance-' || auth.uid()::text)
    OR realtime.topic() = ('track-purchases-' || auth.uid()::text)
  )
);
