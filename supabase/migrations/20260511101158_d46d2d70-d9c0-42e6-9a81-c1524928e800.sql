ALTER TABLE public.analytics_settings ADD COLUMN IF NOT EXISTS cf_analytics_token text;

UPDATE public.analytics_settings a
   SET cf_analytics_token = s.cf_analytics_token
  FROM public.store_settings s
 WHERE a.id = 1 AND s.id = 1 AND s.cf_analytics_token IS NOT NULL;

ALTER TABLE public.store_settings DROP COLUMN IF EXISTS cf_analytics_token;

CREATE OR REPLACE FUNCTION public.get_cf_analytics_token()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT NULLIF(trim(cf_analytics_token), '')
    FROM public.analytics_settings
   WHERE id = 1
$$;

REVOKE ALL ON FUNCTION public.get_cf_analytics_token() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_cf_analytics_token() TO anon, authenticated;