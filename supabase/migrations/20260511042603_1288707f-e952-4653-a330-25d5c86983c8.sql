-- Postgres changes channels: rely on underlying table RLS for row filtering
DROP POLICY IF EXISTS "Authenticated postgres_changes subscriptions"  ON realtime.messages;
DROP POLICY IF EXISTS "User-scoped broadcast/presence read"           ON realtime.messages;
DROP POLICY IF EXISTS "User-scoped broadcast send"                    ON realtime.messages;

CREATE POLICY "Authenticated postgres_changes subscriptions"
ON realtime.messages
FOR SELECT
TO authenticated
USING (extension = 'postgres_changes');

-- For broadcast/presence: shared topics are open, user-scoped topics must
-- end with the caller's uid.
CREATE POLICY "User-scoped broadcast/presence read"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  extension IN ('broadcast','presence')
  AND (
    (
      realtime.topic() NOT LIKE 'wallet:%'
      AND realtime.topic() NOT LIKE 'sub_%'
      AND realtime.topic() NOT LIKE 'musichub-balance-%'
      AND realtime.topic() NOT LIKE 'track-purchases-%'
      AND realtime.topic() NOT LIKE 'suno-jobs-%'
    )
    OR realtime.topic() = 'wallet:'           || auth.uid()::text
    OR realtime.topic() = 'sub_'              || auth.uid()::text
    OR realtime.topic() = 'musichub-balance-' || auth.uid()::text
    OR realtime.topic() = 'track-purchases-'  || auth.uid()::text
    OR realtime.topic() = 'suno-jobs-'        || auth.uid()::text
  )
);

CREATE POLICY "User-scoped broadcast send"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  extension = 'broadcast'
  AND (
    (
      realtime.topic() NOT LIKE 'wallet:%'
      AND realtime.topic() NOT LIKE 'sub_%'
      AND realtime.topic() NOT LIKE 'musichub-balance-%'
      AND realtime.topic() NOT LIKE 'track-purchases-%'
      AND realtime.topic() NOT LIKE 'suno-jobs-%'
    )
    OR realtime.topic() = 'wallet:'           || auth.uid()::text
    OR realtime.topic() = 'sub_'              || auth.uid()::text
    OR realtime.topic() = 'musichub-balance-' || auth.uid()::text
    OR realtime.topic() = 'track-purchases-'  || auth.uid()::text
    OR realtime.topic() = 'suno-jobs-'        || auth.uid()::text
  )
);