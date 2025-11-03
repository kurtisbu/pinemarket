-- Allow 'flexible' pricing model for programs with multiple price options
ALTER TABLE public.programs 
DROP CONSTRAINT IF EXISTS programs_pricing_model_check;

ALTER TABLE public.programs
ADD CONSTRAINT programs_pricing_model_check 
CHECK (pricing_model IN ('one_time', 'subscription', 'flexible'));