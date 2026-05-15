ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_friends_family boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS profiles_is_friends_family_idx
  ON public.profiles (is_friends_family) WHERE is_friends_family;