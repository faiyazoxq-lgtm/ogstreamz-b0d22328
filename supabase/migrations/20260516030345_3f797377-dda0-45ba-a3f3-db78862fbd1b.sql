-- Remove the earlier NOT VALID placeholder constraint (added with the
-- race-condition fix) so we can replace it with a properly validated
-- constraint under the canonical name.
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_credits_non_negative;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS credits_non_negative;

ALTER TABLE public.profiles
  ADD CONSTRAINT credits_non_negative CHECK (credits >= 0);