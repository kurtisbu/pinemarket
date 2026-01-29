
-- Create ratings table for script reviews
CREATE TABLE public.ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(program_id, user_id) -- One rating per user per program
);

-- Enable RLS
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;

-- Users can view all ratings (for transparency)
CREATE POLICY "Anyone can view ratings" ON public.ratings
FOR SELECT USING (true);

-- Users can insert ratings only for programs they purchased
CREATE POLICY "Users can rate purchased programs" ON public.ratings
FOR INSERT WITH CHECK (
  auth.uid() = user_id AND
  EXISTS (
    SELECT 1 FROM public.purchases 
    WHERE program_id = ratings.program_id 
    AND buyer_id = auth.uid() 
    AND status = 'completed'
  )
);

-- Users can update their own ratings
CREATE POLICY "Users can update own ratings" ON public.ratings
FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own ratings
CREATE POLICY "Users can delete own ratings" ON public.ratings
FOR DELETE USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER handle_ratings_updated_at
BEFORE UPDATE ON public.ratings
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Create function to update program rating statistics
CREATE OR REPLACE FUNCTION update_program_rating_stats(program_uuid UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.programs 
  SET 
    average_rating = COALESCE((
      SELECT AVG(rating::numeric) 
      FROM public.ratings 
      WHERE program_id = program_uuid
    ), 0),
    rating_count = COALESCE((
      SELECT COUNT(*) 
      FROM public.ratings 
      WHERE program_id = program_uuid
    ), 0)
  WHERE id = program_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically update program stats when ratings change
CREATE OR REPLACE FUNCTION handle_rating_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM update_program_rating_stats(OLD.program_id);
    RETURN OLD;
  ELSE
    PERFORM update_program_rating_stats(NEW.program_id);
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ratings_stats_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.ratings
FOR EACH ROW EXECUTE FUNCTION handle_rating_change();
