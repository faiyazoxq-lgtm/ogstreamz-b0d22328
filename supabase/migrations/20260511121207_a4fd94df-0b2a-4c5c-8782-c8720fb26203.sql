-- Public buckets serve files via their public URL without needing a
-- SELECT policy on storage.objects. The broad "Public read" policies
-- below ALSO permitted the storage list API to enumerate every file
-- in the bucket, which the linter flags. Drop them; direct public URL
-- access continues to work for avatars and portal media.
DROP POLICY IF EXISTS "Public read avatars" ON storage.objects;
DROP POLICY IF EXISTS "Public read portals-media" ON storage.objects;
