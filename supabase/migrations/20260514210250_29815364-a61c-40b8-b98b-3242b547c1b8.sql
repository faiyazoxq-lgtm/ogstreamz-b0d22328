CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- No client policies — only the service-role admin client (used in server fns
-- gated by checkIsBoss) may read or write. This keeps STREAM_SERVER_URL hidden
-- from members and crawlers.
COMMENT ON TABLE public.app_settings IS 'Boss-managed key/value app settings. Service-role-only access; gate writes via checkIsBoss in server functions.';

CREATE OR REPLACE FUNCTION public.touch_app_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS app_settings_touch ON public.app_settings;
CREATE TRIGGER app_settings_touch
BEFORE UPDATE ON public.app_settings
FOR EACH ROW EXECUTE FUNCTION public.touch_app_settings_updated_at();