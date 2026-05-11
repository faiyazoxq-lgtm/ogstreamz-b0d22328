-- Public read (mirrors the bucket's public flag for clarity / linter compliance)
DROP POLICY IF EXISTS "Public read portals-media"   ON storage.objects;
DROP POLICY IF EXISTS "Boss writes portals-media"   ON storage.objects;
DROP POLICY IF EXISTS "Boss updates portals-media"  ON storage.objects;
DROP POLICY IF EXISTS "Boss deletes portals-media"  ON storage.objects;

CREATE POLICY "Public read portals-media"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'portals-media');

CREATE POLICY "Boss writes portals-media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'portals-media'
  AND (public.is_boss(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role))
);

CREATE POLICY "Boss updates portals-media"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'portals-media'
  AND (public.is_boss(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role))
)
WITH CHECK (
  bucket_id = 'portals-media'
  AND (public.is_boss(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role))
);

CREATE POLICY "Boss deletes portals-media"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'portals-media'
  AND (public.is_boss(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role))
);