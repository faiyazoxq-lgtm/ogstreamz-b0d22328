-- Track which expiry-reminder thresholds we've already notified per user
CREATE TABLE IF NOT EXISTS public.stream_expiry_reminders (
  user_id uuid NOT NULL,
  expires_at timestamptz NOT NULL,
  threshold_days integer NOT NULL,
  notified_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, expires_at, threshold_days)
);
ALTER TABLE public.stream_expiry_reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Boss reads stream expiry reminders"
  ON public.stream_expiry_reminders FOR SELECT TO authenticated
  USING (is_boss(auth.uid()) OR has_role(auth.uid(),'admin'::app_role));

-- Helper: insert a targeted vip_notification for a single user
CREATE OR REPLACE FUNCTION public.notify_user(
  _user_id uuid, _title text, _body text, _severity text, _link text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.vip_notifications (user_id, title, body, link_url, severity, audience, created_by)
  VALUES (_user_id, _title, _body, _link, _severity, 'ogs', _user_id);
END $$;

-- Trigger: stream verification request lifecycle -> notify user
CREATE OR REPLACE FUNCTION public.tg_stream_request_notify()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.notify_user(
      NEW.user_id,
      'Stream profile pending review',
      'Your OGSTREAMZ credentials are with the Boss. We''ll ping you the moment they''re approved.',
      'info',
      '/account'
    );
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'approved' THEN
      PERFORM public.notify_user(
        NEW.user_id,
        'Stream profile approved ✅',
        'You''re cleared. Hit the home screen to start streaming.',
        'success',
        '/'
      );
    ELSIF NEW.status = 'rejected' THEN
      PERFORM public.notify_user(
        NEW.user_id,
        'Stream profile rejected',
        COALESCE('Boss note: ' || NULLIF(NEW.decision_note,''), 'Re-check your credentials and resubmit.'),
        'warning',
        '/account'
      );
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS svr_notify ON public.stream_verification_requests;
CREATE TRIGGER svr_notify
AFTER INSERT OR UPDATE ON public.stream_verification_requests
FOR EACH ROW EXECUTE FUNCTION public.tg_stream_request_notify();

-- Daily check for expiring stream profiles -> in-app reminders at 7d, 3d, 1d, expired
CREATE OR REPLACE FUNCTION public.notify_stream_expiring_soon()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  rec record;
  threshold int;
  hours_left numeric;
  sent int := 0;
BEGIN
  FOR rec IN
    SELECT id, stream_expires_at
    FROM public.profiles
    WHERE stream_expires_at IS NOT NULL
      AND stream_expires_at > now() - interval '1 day'
      AND stream_expires_at < now() + interval '8 days'
  LOOP
    hours_left := EXTRACT(EPOCH FROM (rec.stream_expires_at - now())) / 3600.0;
    threshold := CASE
      WHEN hours_left <= 0 THEN 0
      WHEN hours_left <= 24 THEN 1
      WHEN hours_left <= 72 THEN 3
      WHEN hours_left <= 168 THEN 7
      ELSE NULL
    END;
    CONTINUE WHEN threshold IS NULL;
    -- Skip if already notified for this expiry+threshold
    IF EXISTS (
      SELECT 1 FROM public.stream_expiry_reminders
      WHERE user_id = rec.id AND expires_at = rec.stream_expires_at AND threshold_days = threshold
    ) THEN CONTINUE; END IF;

    PERFORM public.notify_user(
      rec.id,
      CASE threshold
        WHEN 0 THEN 'Stream profile expired'
        WHEN 1 THEN 'Stream profile expires in 24 hours'
        WHEN 3 THEN 'Stream profile expires in 3 days'
        ELSE 'Stream profile expires in 7 days'
      END,
      CASE WHEN threshold = 0
        THEN 'Re-link your OGSTREAMZ credentials to keep streaming.'
        ELSE 'Heads up — relink your OGSTREAMZ credentials before the deadline to avoid downtime.'
      END,
      CASE WHEN threshold <= 1 THEN 'alert' WHEN threshold <= 3 THEN 'warning' ELSE 'info' END,
      '/account'
    );
    INSERT INTO public.stream_expiry_reminders (user_id, expires_at, threshold_days)
    VALUES (rec.id, rec.stream_expires_at, threshold)
    ON CONFLICT DO NOTHING;
    sent := sent + 1;
  END LOOP;
  RETURN sent;
END $$;

-- Schedule daily at 09:00 UTC
DO $$ BEGIN
  PERFORM cron.unschedule('stream-expiry-reminders');
EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule(
  'stream-expiry-reminders',
  '0 9 * * *',
  $cron$ SELECT public.notify_stream_expiring_soon(); $cron$
);