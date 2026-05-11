
-- Authenticated user-scoped uploads for portals-media bucket.
-- Convention: object path must begin with the uploader's auth.uid() folder,
-- e.g. "<auth.uid()>/<portal-slug>/cover.png".

DROP POLICY IF EXISTS "Users upload own portals-media" ON storage.objects;
CREATE POLICY "Users upload own portals-media"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'portals-media'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users update own portals-media" ON storage.objects;
CREATE POLICY "Users update own portals-media"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'portals-media'
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'portals-media'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users delete own portals-media" ON storage.objects;
CREATE POLICY "Users delete own portals-media"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'portals-media'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
