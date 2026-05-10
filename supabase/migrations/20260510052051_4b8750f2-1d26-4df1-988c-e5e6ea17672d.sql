CREATE OR REPLACE FUNCTION public.validate_profile_stream_links()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  entries jsonb;
  entry jsonb;
  platform text;
  raw_value text;
  canonical text;
  seen text[] := ARRAY[]::text[];
BEGIN
  IF NEW.stream_links IS NULL OR jsonb_typeof(NEW.stream_links) <> 'object' THEN
    RETURN NEW;
  END IF;

  entries := NEW.stream_links -> 'entries';
  IF entries IS NULL OR jsonb_typeof(entries) <> 'array' THEN
    RETURN NEW;
  END IF;

  IF jsonb_array_length(entries) > 25 THEN
    RAISE EXCEPTION 'Too many stream entries (max 25)';
  END IF;

  FOR entry IN SELECT * FROM jsonb_array_elements(entries) LOOP
    platform := lower(coalesce(entry->>'platform',''));
    raw_value := lower(trim(coalesce(entry->>'value','')));

    IF raw_value = '' THEN CONTINUE; END IF;
    IF length(raw_value) > 300 THEN
      RAISE EXCEPTION 'Stream entry value too long (max 300 chars)';
    END IF;
    IF platform NOT IN ('twitch','youtube','kick','custom') THEN
      RAISE EXCEPTION 'Invalid stream platform: %', platform;
    END IF;

    -- Canonicalize: strip scheme, www., and any trailing slashes so that
    -- "https://twitch.tv/foo", "twitch.tv/foo/" and "https://www.twitch.tv/foo"
    -- all collapse to the same dedupe key.
    canonical := regexp_replace(raw_value, '^https?://', '');
    canonical := regexp_replace(canonical, '^www\.', '');
    canonical := regexp_replace(canonical, '/+$', '');
    canonical := platform || ':' || canonical;

    IF canonical = ANY(seen) THEN
      RAISE EXCEPTION 'Duplicate stream entry detected: %', entry->>'value';
    END IF;
    seen := array_append(seen, canonical);
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_validate_stream_links ON public.profiles;

CREATE TRIGGER profiles_validate_stream_links
BEFORE INSERT OR UPDATE OF stream_links ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.validate_profile_stream_links();