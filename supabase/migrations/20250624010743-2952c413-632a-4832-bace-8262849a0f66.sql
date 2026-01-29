
-- Add subscription-related columns to programs table
ALTER TABLE public.programs 
ADD COLUMN IF NOT EXISTS monthly_price NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS yearly_price NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS billing_interval TEXT CHECK (billing_interval IN ('month', 'year', 'both'));

-- Update existing programs to have default values
UPDATE public.programs 
SET monthly_price = NULL, 
    yearly_price = NULL, 
    billing_interval = NULL
WHERE pricing_model = 'one_time';
