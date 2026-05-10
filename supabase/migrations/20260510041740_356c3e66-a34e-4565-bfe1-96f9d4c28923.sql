CREATE POLICY "Boss manages portals"
ON public.portals
FOR ALL
TO authenticated
USING (is_boss(auth.uid()))
WITH CHECK (is_boss(auth.uid()));