
-- Create secure storage buckets for Pine Scripts and program media
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('pine-scripts', 'pine-scripts', false, 10485760, ARRAY['text/plain', 'application/octet-stream']),
  ('program-media', 'program-media', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO NOTHING;

-- Drop existing storage policies to avoid conflicts
DROP POLICY IF EXISTS "Sellers can upload their own scripts" ON storage.objects;
DROP POLICY IF EXISTS "Sellers can update their own scripts" ON storage.objects;
DROP POLICY IF EXISTS "Sellers can delete their own scripts" ON storage.objects;
DROP POLICY IF EXISTS "Buyers can access purchased scripts" ON storage.objects;
DROP POLICY IF EXISTS "Public access to program media" ON storage.objects;
DROP POLICY IF EXISTS "Sellers can upload program media" ON storage.objects;
DROP POLICY IF EXISTS "Sellers can update their own program media" ON storage.objects;
DROP POLICY IF EXISTS "Sellers can delete their own program media" ON storage.objects;

-- Pine Scripts bucket policies (secure - only authorized access)
CREATE POLICY "Sellers can upload their own scripts" ON storage.objects 
  FOR INSERT 
  WITH CHECK (
    bucket_id = 'pine-scripts' 
    AND auth.role() = 'authenticated'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Sellers can update their own scripts" ON storage.objects 
  FOR UPDATE 
  USING (
    bucket_id = 'pine-scripts' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Sellers can delete their own scripts" ON storage.objects 
  FOR DELETE 
  USING (
    bucket_id = 'pine-scripts' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Critical: Only allow script access to buyers who have purchased
CREATE POLICY "Buyers can access purchased scripts" ON storage.objects 
  FOR SELECT 
  USING (
    bucket_id = 'pine-scripts' 
    AND auth.role() = 'authenticated'
    AND (
      -- Seller can always access their own scripts
      auth.uid()::text = (storage.foldername(name))[1]
      OR
      -- Buyer can access if they have a completed purchase
      EXISTS (
        SELECT 1 FROM public.purchases p
        JOIN public.programs pr ON p.program_id = pr.id
        WHERE p.buyer_id = auth.uid()
        AND p.status = 'completed'
        AND pr.script_file_path = name
      )
    )
  );

-- Program media bucket policies (public for marketing)
CREATE POLICY "Public access to program media" ON storage.objects 
  FOR SELECT 
  USING (bucket_id = 'program-media');

CREATE POLICY "Sellers can upload program media" ON storage.objects 
  FOR INSERT 
  WITH CHECK (
    bucket_id = 'program-media' 
    AND auth.role() = 'authenticated'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Sellers can update their own program media" ON storage.objects 
  FOR UPDATE 
  USING (
    bucket_id = 'program-media' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Sellers can delete their own program media" ON storage.objects 
  FOR DELETE 
  USING (
    bucket_id = 'program-media' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Add function to securely get script download URL for purchased scripts
CREATE OR REPLACE FUNCTION public.get_script_download_url(program_id_param UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  script_path TEXT;
  has_access BOOLEAN := FALSE;
BEGIN
  -- Get the script file path
  SELECT script_file_path INTO script_path
  FROM public.programs
  WHERE id = program_id_param;
  
  IF script_path IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Check if user has access (either seller or buyer with completed purchase)
  SELECT EXISTS(
    SELECT 1 FROM public.programs p
    WHERE p.id = program_id_param
    AND p.seller_id = auth.uid()
  ) OR EXISTS(
    SELECT 1 FROM public.purchases pu
    WHERE pu.program_id = program_id_param
    AND pu.buyer_id = auth.uid()
    AND pu.status = 'completed'
  ) INTO has_access;
  
  IF NOT has_access THEN
    RAISE EXCEPTION 'Access denied: You must purchase this program to download the script';
  END IF;
  
  -- Return the signed URL (this would be called from an edge function)
  RETURN script_path;
END;
$$;

-- Create assignment_logs table for tracking script assignment activities
CREATE TABLE IF NOT EXISTS public.assignment_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES public.script_assignments(id) ON DELETE CASCADE,
  purchase_id UUID NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
  log_level TEXT NOT NULL CHECK (log_level IN ('info', 'warning', 'error', 'success')),
  message TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on assignment_logs
ALTER TABLE public.assignment_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for assignment_logs
CREATE POLICY "Sellers can view logs for their assignments" ON public.assignment_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.script_assignments sa
      WHERE sa.id = assignment_id
      AND sa.seller_id = auth.uid()
    )
  );

CREATE POLICY "Service can insert assignment logs" ON public.assignment_logs
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Service can update assignment logs" ON public.assignment_logs
  FOR UPDATE USING (true);
