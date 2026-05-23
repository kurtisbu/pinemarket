
-- 1. Storage 'scripts' bucket: replace overly-broad authenticated SELECT/INSERT with owner-scoped policies
DROP POLICY IF EXISTS "Authenticated users can view scripts" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload scripts" ON storage.objects;

CREATE POLICY "Users can view their own scripts (scripts bucket)"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'scripts'
  AND auth.role() = 'authenticated'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can upload their own scripts (scripts bucket)"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'scripts'
  AND auth.role() = 'authenticated'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

-- 2. rate_limits: remove redundant public-role policy (service_role-scoped policy still exists)
DROP POLICY IF EXISTS "Service role can manage rate limits" ON public.rate_limits;

-- 3. user_roles: remove redundant public-role policy (replace with service_role-scoped policy)
DROP POLICY IF EXISTS "Service role can manage user roles" ON public.user_roles;

CREATE POLICY "Service can manage user roles"
ON public.user_roles
AS PERMISSIVE
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
