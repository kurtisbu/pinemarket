-- Create program_prices table to support multiple pricing options per program
CREATE TABLE public.program_prices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  price_type TEXT NOT NULL CHECK (price_type IN ('one_time', 'recurring')),
  amount NUMERIC NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  interval TEXT CHECK (interval IN ('month', '3_months', 'year')),
  display_name TEXT NOT NULL,
  description TEXT,
  stripe_price_id TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT valid_recurring_interval CHECK (
    (price_type = 'recurring' AND interval IS NOT NULL) OR 
    (price_type = 'one_time' AND interval IS NULL)
  )
);

-- Create index for faster lookups
CREATE INDEX idx_program_prices_program_id ON public.program_prices(program_id);
CREATE INDEX idx_program_prices_active ON public.program_prices(program_id, is_active);

-- Enable RLS
ALTER TABLE public.program_prices ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Everyone can view prices for published programs"
  ON public.program_prices
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.programs
      WHERE programs.id = program_prices.program_id
      AND programs.status = 'published'
    )
  );

CREATE POLICY "Sellers can view prices for their own programs"
  ON public.program_prices
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.programs
      WHERE programs.id = program_prices.program_id
      AND programs.seller_id = auth.uid()
    )
  );

CREATE POLICY "Sellers can insert prices for their own programs"
  ON public.program_prices
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.programs
      WHERE programs.id = program_prices.program_id
      AND programs.seller_id = auth.uid()
    )
  );

CREATE POLICY "Sellers can update prices for their own programs"
  ON public.program_prices
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.programs
      WHERE programs.id = program_prices.program_id
      AND programs.seller_id = auth.uid()
    )
  );

CREATE POLICY "Sellers can delete prices for their own programs"
  ON public.program_prices
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.programs
      WHERE programs.id = program_prices.program_id
      AND programs.seller_id = auth.uid()
    )
  );

-- Add trigger for updated_at
CREATE TRIGGER update_program_prices_updated_at
  BEFORE UPDATE ON public.program_prices
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();