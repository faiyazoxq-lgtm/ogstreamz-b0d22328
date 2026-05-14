INSERT INTO storage.buckets (id, name, public)
VALUES ('store-media', 'store-media', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read store-media"
ON storage.objects FOR SELECT
USING (bucket_id = 'store-media');

CREATE POLICY "Boss insert store-media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'store-media' AND public.is_boss(auth.uid()));

CREATE POLICY "Boss update store-media"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'store-media' AND public.is_boss(auth.uid()))
WITH CHECK (bucket_id = 'store-media' AND public.is_boss(auth.uid()));

CREATE POLICY "Boss delete store-media"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'store-media' AND public.is_boss(auth.uid()));