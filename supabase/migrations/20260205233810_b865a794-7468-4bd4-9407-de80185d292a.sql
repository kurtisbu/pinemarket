-- Add policy to allow public viewing of basic profile information
-- This is needed for product pages to display seller information
CREATE POLICY "Anyone can view public profile fields" 
ON public.profiles 
FOR SELECT 
USING (true);