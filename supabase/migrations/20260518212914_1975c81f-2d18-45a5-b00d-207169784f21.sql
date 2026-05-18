ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS hub_access boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_profiles_hub_access
  ON public.profiles (hub_access) WHERE hub_access = true;