-- Function: downgrade expired stream users (preserve vip / boss)
CREATE OR REPLACE FUNCTION public.downgrade_expired_stream_users()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected integer;
BEGIN
  UPDATE public.profiles
     SET rank = 'enforcer'::syndicate_rank,
         stream_status = 'expired',
         updated_at = now()
   WHERE rank = 'stream_user'::syndicate_rank
     AND stream_expires_at IS NOT NULL
     AND stream_expires_at < now();
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

REVOKE ALL ON FUNCTION public.downgrade_expired_stream_users() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.downgrade_expired_stream_users() TO service_role;

-- Schedule: every 15 minutes
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'downgrade-expired-stream-users') THEN
    PERFORM cron.unschedule('downgrade-expired-stream-users');
  END IF;
  PERFORM cron.schedule(
    'downgrade-expired-stream-users',
    '*/15 * * * *',
    $cron$ SELECT public.downgrade_expired_stream_users(); $cron$
  );
END$$;