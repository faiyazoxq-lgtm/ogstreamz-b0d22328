DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

CREATE POLICY "Boss can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (is_boss(auth.uid()));
