DROP POLICY IF EXISTS "Public reads denylist" ON public.domain_denylist;

CREATE POLICY "Boss/admin reads denylist"
ON public.domain_denylist
FOR SELECT
TO authenticated
USING (is_boss(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));