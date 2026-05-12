-- Defense-in-depth: explicitly restrict writes to portal-bg storage bucket to boss/admin only.
-- Currently no INSERT/UPDATE/DELETE policies exist, so writes are denied by default,
-- but explicit policies make intent clear and survive any future broad storage policies.

CREATE POLICY "Boss writes portal-bg"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'portal-bg'
  AND (public.is_boss(auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role))
);

CREATE POLICY "Boss updates portal-bg"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'portal-bg'
  AND (public.is_boss(auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role))
);

CREATE POLICY "Boss deletes portal-bg"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'portal-bg'
  AND (public.is_boss(auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role))
);