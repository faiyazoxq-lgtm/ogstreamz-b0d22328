-- Explicit deny-all RLS policies for sensitive credential tables.
-- These tables are only ever touched via SECURITY DEFINER boss_* functions,
-- so no direct client access of any kind should be permitted.

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    '_stream_link_key',
    'agent_api_keys',
    'stream_account_links',
    'stream_verification_requests'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_no_select', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_no_insert', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_no_update', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_no_delete', t);

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated, anon USING (false)',
      t || '_no_select', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated, anon WITH CHECK (false)',
      t || '_no_insert', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated, anon USING (false) WITH CHECK (false)',
      t || '_no_update', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated, anon USING (false)',
      t || '_no_delete', t);
  END LOOP;
END $$;