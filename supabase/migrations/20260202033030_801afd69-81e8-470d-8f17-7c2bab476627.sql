-- First add the column
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS custom_platform_fee_percent numeric DEFAULT NULL;

-- Add check constraint
ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_custom_platform_fee_percent_check 
CHECK (custom_platform_fee_percent IS NULL OR 
       (custom_platform_fee_percent >= 0 AND custom_platform_fee_percent <= 100));

COMMENT ON COLUMN public.profiles.custom_platform_fee_percent IS 
  'Custom platform fee percentage for featured creators. NULL means use default (10%).';