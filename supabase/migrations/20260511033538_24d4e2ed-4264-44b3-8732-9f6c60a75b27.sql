-- Enable RLS on realtime.messages so broadcast/presence subscriptions
-- are denied by default for anon and authenticated roles. service_role
-- (used by postgres_changes infrastructure and trusted server code)
-- bypasses RLS, so database-change streams remain functional.
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;