
CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "app_settings public read"
  ON public.app_settings FOR SELECT
  USING (true);

CREATE POLICY "app_settings boss write"
  ON public.app_settings FOR ALL
  USING (public.is_boss(auth.uid()) OR public.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (public.is_boss(auth.uid()) OR public.has_role(auth.uid(),'admin'::app_role));

CREATE TRIGGER trg_app_settings_touch
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.app_settings (key, value)
  VALUES ('signup_bonus_credits', to_jsonb(2))
  ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_signup_bonus_credits()
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT GREATEST(0, LEAST(1000,
    COALESCE((SELECT (value)::int FROM public.app_settings WHERE key='signup_bonus_credits'), 2)
  ))
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ref_id uuid;
  bonus  integer := public.get_signup_bonus_credits();
BEGIN
  BEGIN
    ref_id := NULLIF(NEW.raw_user_meta_data->>'referred_by_reseller','')::uuid;
  EXCEPTION WHEN others THEN ref_id := NULL;
  END;

  INSERT INTO public.profiles (id, email, credits, status, rank, referred_by_reseller)
  VALUES (NEW.id, NEW.email, bonus, 'free', 'prospect'::public.syndicate_rank, ref_id)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT DO NOTHING;

  PERFORM public.apply_pending_grants(NEW.id, NEW.email);
  RETURN NEW;
END $$;
