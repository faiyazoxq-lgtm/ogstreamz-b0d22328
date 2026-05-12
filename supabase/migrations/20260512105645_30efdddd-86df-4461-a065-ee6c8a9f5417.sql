CREATE TABLE public.referral_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  referral_code text NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('copied','opened','shared','share_failed')),
  source text NOT NULL DEFAULT 'vip_pass_card',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX referral_events_user_id_created_at_idx
  ON public.referral_events (user_id, created_at DESC);
CREATE INDEX referral_events_code_idx
  ON public.referral_events (referral_code);

ALTER TABLE public.referral_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own referral events" ON public.referral_events
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users read own referral events" ON public.referral_events
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Boss reads all referral events" ON public.referral_events
  FOR SELECT TO authenticated
  USING (is_boss(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));