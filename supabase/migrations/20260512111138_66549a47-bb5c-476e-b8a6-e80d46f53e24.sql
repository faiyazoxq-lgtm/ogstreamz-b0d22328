-- Lock down swear_lexicon SELECT to authenticated users only.
-- The lexicon includes refusal_patterns regexes used to detect AI jailbreak
-- attempts; exposing them to anonymous users helps adversaries craft bypasses.
DROP POLICY IF EXISTS "Public read swear lexicon" ON public.swear_lexicon;
DROP POLICY IF EXISTS "Authenticated read swear lexicon" ON public.swear_lexicon;

CREATE POLICY "Authenticated read swear lexicon"
  ON public.swear_lexicon
  FOR SELECT
  TO authenticated
  USING (true);
