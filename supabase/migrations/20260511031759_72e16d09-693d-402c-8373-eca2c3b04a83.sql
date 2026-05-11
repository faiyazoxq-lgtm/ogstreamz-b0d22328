-- Canonical trigger helper used by many migrations. Previously only existed in
-- the `storage` schema, so any migration doing
--   EXECUTE FUNCTION public.update_updated_at_column()
-- would fail. Define it once in `public` so future deploys (including
-- boss_todos and any new tables) apply cleanly.
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;