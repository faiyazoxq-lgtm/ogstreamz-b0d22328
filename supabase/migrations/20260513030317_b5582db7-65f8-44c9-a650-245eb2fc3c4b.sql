
-- Sequence for OG Pass numbers
CREATE SEQUENCE IF NOT EXISTS public.og_pass_no_seq;

-- Column on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS og_pass_no bigint;

-- Backfill in created_at order so OG Pass #1 = earliest member
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at, id) AS rn
  FROM public.profiles
  WHERE og_pass_no IS NULL
)
UPDATE public.profiles p
SET og_pass_no = o.rn
FROM ordered o
WHERE p.id = o.id;

-- Advance sequence past the backfill
SELECT setval(
  'public.og_pass_no_seq',
  GREATEST(COALESCE((SELECT MAX(og_pass_no) FROM public.profiles), 0), 1)
);

-- Default + uniqueness for future inserts
ALTER TABLE public.profiles
  ALTER COLUMN og_pass_no SET DEFAULT nextval('public.og_pass_no_seq');

ALTER TABLE public.profiles
  ALTER COLUMN og_pass_no SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_og_pass_no_uniq
  ON public.profiles (og_pass_no);

ALTER SEQUENCE public.og_pass_no_seq OWNED BY public.profiles.og_pass_no;
