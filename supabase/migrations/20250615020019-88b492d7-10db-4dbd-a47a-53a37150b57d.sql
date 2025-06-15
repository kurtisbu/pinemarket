
-- Create a table to store scripts scraped from TradingView profiles
CREATE TABLE public.tradingview_scripts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  script_id TEXT NOT NULL,
  title TEXT NOT NULL,
  publication_url TEXT NOT NULL,
  image_url TEXT,
  likes INTEGER NOT NULL DEFAULT 0,
  reviews_count INTEGER NOT NULL DEFAULT 0,
  version TEXT,
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, script_id)
);

-- Add RLS policies for the new table
ALTER TABLE public.tradingview_scripts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own TradingView scripts"
  ON public.tradingview_scripts
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Remove old validation columns from programs table
ALTER TABLE public.programs DROP COLUMN IF EXISTS validation_status;
ALTER TABLE public.programs DROP COLUMN IF EXISTS last_validated_at;
ALTER TABLE public.programs DROP COLUMN IF EXISTS validation_error_message;

-- Drop the now unused enum type
DROP TYPE IF EXISTS public.program_validation_status;
