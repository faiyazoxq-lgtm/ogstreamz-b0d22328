ALTER TABLE public.vip_notifications
  ADD COLUMN IF NOT EXISTS audience text NOT NULL DEFAULT 'ogs';

ALTER TABLE public.vip_notifications
  DROP CONSTRAINT IF EXISTS vip_notifications_audience_chk;
ALTER TABLE public.vip_notifications
  ADD CONSTRAINT vip_notifications_audience_chk
  CHECK (audience IN ('all','members','ogs'));

DROP POLICY IF EXISTS "VIPs read targeted or broadcast notifications" ON public.vip_notifications;
DROP POLICY IF EXISTS "Read notifications by audience" ON public.vip_notifications;

CREATE POLICY "Read notifications by audience"
  ON public.vip_notifications
  FOR SELECT
  USING (
    public.is_boss(auth.uid())
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR (audience = 'all')
    OR (audience = 'members' AND auth.uid() IS NOT NULL)
    OR (audience = 'ogs' AND public.is_real_og(auth.uid()) AND (user_id IS NULL OR user_id = auth.uid()))
    OR (user_id IS NOT NULL AND user_id = auth.uid())
  );