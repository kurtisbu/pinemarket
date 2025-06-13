
-- Add new columns to the programs table for sorting and display
ALTER TABLE public.programs 
ADD COLUMN view_count NUMERIC DEFAULT 0 NOT NULL,
ADD COLUMN download_count NUMERIC DEFAULT 0 NOT NULL,
ADD COLUMN average_rating NUMERIC DEFAULT 0 NOT NULL,
ADD COLUMN rating_count NUMERIC DEFAULT 0 NOT NULL;

-- Create an index on status and created_at for better performance on the browse page
CREATE INDEX idx_programs_status_created_at ON public.programs(status, created_at DESC);

-- Create an index on category for filtering
CREATE INDEX idx_programs_category ON public.programs(category);

-- Create a function to increment view count
CREATE OR REPLACE FUNCTION increment_program_view_count(program_uuid UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.programs 
  SET view_count = view_count + 1 
  WHERE id = program_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Allow public access to increment view count (for anonymous users viewing programs)
GRANT EXECUTE ON FUNCTION increment_program_view_count(UUID) TO anon;
GRANT EXECUTE ON FUNCTION increment_program_view_count(UUID) TO authenticated;
