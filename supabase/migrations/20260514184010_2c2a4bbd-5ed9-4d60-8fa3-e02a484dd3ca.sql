CREATE POLICY "Users read own portals-media"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'portals-media'
  AND (
    (auth.uid())::text = (storage.foldername(name))[1]
    OR public.is_boss(auth.uid())
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  )
);