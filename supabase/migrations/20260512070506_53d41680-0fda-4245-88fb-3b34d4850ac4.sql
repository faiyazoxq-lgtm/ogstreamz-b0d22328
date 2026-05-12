
-- Explicit public SELECT policies for already-public buckets (auditability)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Public read avatars bucket'
  ) THEN
    CREATE POLICY "Public read avatars bucket"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'avatars');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Public read portals-media bucket'
  ) THEN
    CREATE POLICY "Public read portals-media bucket"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'portals-media');
  END IF;
END $$;

-- Rate-limit anonymous magic_link_audit inserts to mitigate spam/enumeration
CREATE OR REPLACE FUNCTION public.magic_link_audit_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recent_count int;
BEGIN
  IF NEW.email IS NULL OR length(trim(NEW.email)) = 0 THEN
    RAISE EXCEPTION 'email required';
  END IF;
  -- Cap at 10 audit rows per email per rolling 10-minute window
  SELECT count(*) INTO recent_count
    FROM public.magic_link_audit
   WHERE lower(email) = lower(NEW.email)
     AND created_at > now() - interval '10 minutes';
  IF recent_count >= 10 THEN
    RAISE EXCEPTION 'rate_limited' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS magic_link_audit_rate_limit_trg ON public.magic_link_audit;
CREATE TRIGGER magic_link_audit_rate_limit_trg
BEFORE INSERT ON public.magic_link_audit
FOR EACH ROW EXECUTE FUNCTION public.magic_link_audit_rate_limit();
