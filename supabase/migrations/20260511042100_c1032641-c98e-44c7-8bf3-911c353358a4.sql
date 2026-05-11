CREATE POLICY "Public reads denylist"
ON public.domain_denylist
FOR SELECT
TO anon, authenticated
USING (true);