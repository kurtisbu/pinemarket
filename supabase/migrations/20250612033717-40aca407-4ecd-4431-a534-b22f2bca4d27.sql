
-- Create the programs table
CREATE TABLE public.programs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  seller_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
  category TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  script_file_path TEXT,
  image_urls TEXT[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for programs table
ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;

-- Sellers can view their own programs
CREATE POLICY "Sellers can view their own programs" 
  ON public.programs 
  FOR SELECT 
  USING (seller_id = auth.uid());

-- Everyone can view published programs
CREATE POLICY "Everyone can view published programs" 
  ON public.programs 
  FOR SELECT 
  USING (status = 'published');

-- Sellers can create their own programs
CREATE POLICY "Sellers can create programs" 
  ON public.programs 
  FOR INSERT 
  WITH CHECK (seller_id = auth.uid());

-- Sellers can update their own programs
CREATE POLICY "Sellers can update their own programs" 
  ON public.programs 
  FOR UPDATE 
  USING (seller_id = auth.uid());

-- Sellers can delete their own programs
CREATE POLICY "Sellers can delete their own programs" 
  ON public.programs 
  FOR DELETE 
  USING (seller_id = auth.uid());

-- Create scripts storage bucket (secure - only for authenticated users)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'scripts', 
  'scripts', 
  false, -- Private bucket
  10485760, -- 10MB limit
  ARRAY['text/plain', 'application/octet-stream']
);

-- Create program-media storage bucket (public)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'program-media', 
  'program-media', 
  true, 
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
);

-- Scripts bucket policies (secure access)
CREATE POLICY "Authenticated users can upload scripts" ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'scripts' AND auth.role() = 'authenticated');

CREATE POLICY "Users can update their own scripts" ON storage.objects FOR UPDATE
USING (bucket_id = 'scripts' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own scripts" ON storage.objects FOR DELETE
USING (bucket_id = 'scripts' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Only authenticated users can view scripts (for purchase verification later)
CREATE POLICY "Authenticated users can view scripts" ON storage.objects FOR SELECT
USING (bucket_id = 'scripts' AND auth.role() = 'authenticated');

-- Program media bucket policies (public access)
CREATE POLICY "Public access to program media" ON storage.objects FOR SELECT
USING (bucket_id = 'program-media');

CREATE POLICY "Authenticated users can upload program media" ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'program-media' AND auth.role() = 'authenticated');

CREATE POLICY "Users can update their own program media" ON storage.objects FOR UPDATE
USING (bucket_id = 'program-media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own program media" ON storage.objects FOR DELETE
USING (bucket_id = 'program-media' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Add updated_at trigger for programs table
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER programs_updated_at
  BEFORE UPDATE ON public.programs
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();
