-- Create program_packages table
CREATE TABLE public.program_packages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  seller_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  image_urls TEXT[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  view_count NUMERIC NOT NULL DEFAULT 0,
  average_rating NUMERIC NOT NULL DEFAULT 0,
  rating_count NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create package_programs junction table (many-to-many)
CREATE TABLE public.package_programs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  package_id UUID NOT NULL REFERENCES public.program_packages(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(package_id, program_id)
);

-- Create package_prices table (similar to program_prices)
CREATE TABLE public.package_prices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  package_id UUID NOT NULL REFERENCES public.program_packages(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  description TEXT,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  price_type TEXT NOT NULL CHECK (price_type IN ('one_time', 'recurring')),
  interval TEXT CHECK (interval IN ('month', 'year')),
  stripe_price_id TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add package_id to purchases table
ALTER TABLE public.purchases 
ADD COLUMN package_id UUID REFERENCES public.program_packages(id);

-- Enable RLS on new tables
ALTER TABLE public.program_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.package_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.package_prices ENABLE ROW LEVEL SECURITY;

-- RLS Policies for program_packages
CREATE POLICY "Everyone can view published packages"
  ON public.program_packages FOR SELECT
  USING (status = 'published');

CREATE POLICY "Sellers can view their own packages"
  ON public.program_packages FOR SELECT
  USING (auth.uid() = seller_id);

CREATE POLICY "Sellers can create packages"
  ON public.program_packages FOR INSERT
  WITH CHECK (auth.uid() = seller_id);

CREATE POLICY "Sellers can update their own packages"
  ON public.program_packages FOR UPDATE
  USING (auth.uid() = seller_id);

CREATE POLICY "Sellers can delete their own packages"
  ON public.program_packages FOR DELETE
  USING (auth.uid() = seller_id);

-- RLS Policies for package_programs
CREATE POLICY "Everyone can view programs in published packages"
  ON public.package_programs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.program_packages
      WHERE program_packages.id = package_programs.package_id
      AND program_packages.status = 'published'
    )
  );

CREATE POLICY "Sellers can view programs in their own packages"
  ON public.package_programs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.program_packages
      WHERE program_packages.id = package_programs.package_id
      AND program_packages.seller_id = auth.uid()
    )
  );

CREATE POLICY "Sellers can add programs to their own packages"
  ON public.package_programs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.program_packages
      WHERE program_packages.id = package_programs.package_id
      AND program_packages.seller_id = auth.uid()
    )
  );

CREATE POLICY "Sellers can update programs in their own packages"
  ON public.package_programs FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.program_packages
      WHERE program_packages.id = package_programs.package_id
      AND program_packages.seller_id = auth.uid()
    )
  );

CREATE POLICY "Sellers can remove programs from their own packages"
  ON public.package_programs FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.program_packages
      WHERE program_packages.id = package_programs.package_id
      AND program_packages.seller_id = auth.uid()
    )
  );

-- RLS Policies for package_prices
CREATE POLICY "Everyone can view prices for published packages"
  ON public.package_prices FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.program_packages
      WHERE program_packages.id = package_prices.package_id
      AND program_packages.status = 'published'
    )
  );

CREATE POLICY "Sellers can view prices for their own packages"
  ON public.package_prices FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.program_packages
      WHERE program_packages.id = package_prices.package_id
      AND program_packages.seller_id = auth.uid()
    )
  );

CREATE POLICY "Sellers can insert prices for their own packages"
  ON public.package_prices FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.program_packages
      WHERE program_packages.id = package_prices.package_id
      AND program_packages.seller_id = auth.uid()
    )
  );

CREATE POLICY "Sellers can update prices for their own packages"
  ON public.package_prices FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.program_packages
      WHERE program_packages.id = package_prices.package_id
      AND program_packages.seller_id = auth.uid()
    )
  );

CREATE POLICY "Sellers can delete prices for their own packages"
  ON public.package_prices FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.program_packages
      WHERE program_packages.id = package_prices.package_id
      AND program_packages.seller_id = auth.uid()
    )
  );

-- Create indexes for better performance
CREATE INDEX idx_package_programs_package_id ON public.package_programs(package_id);
CREATE INDEX idx_package_programs_program_id ON public.package_programs(program_id);
CREATE INDEX idx_package_prices_package_id ON public.package_prices(package_id);
CREATE INDEX idx_purchases_package_id ON public.purchases(package_id);

-- Trigger for updated_at
CREATE TRIGGER update_program_packages_updated_at
  BEFORE UPDATE ON public.program_packages
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_package_prices_updated_at
  BEFORE UPDATE ON public.package_prices
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Function to get package with all programs
CREATE OR REPLACE FUNCTION public.get_package_programs(p_package_id UUID)
RETURNS TABLE(
  program_id UUID,
  title TEXT,
  description TEXT,
  image_urls TEXT[],
  tradingview_publication_url TEXT,
  display_order INTEGER
) 
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    prog.id,
    prog.title,
    prog.description,
    prog.image_urls,
    prog.tradingview_publication_url,
    pp.display_order
  FROM public.programs prog
  JOIN public.package_programs pp ON prog.id = pp.program_id
  WHERE pp.package_id = p_package_id
  ORDER BY pp.display_order;
$$;