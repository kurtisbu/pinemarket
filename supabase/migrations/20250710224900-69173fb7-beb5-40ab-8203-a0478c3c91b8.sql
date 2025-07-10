
-- Update the purchases_amount_positive constraint to allow zero amounts for trials
ALTER TABLE public.purchases DROP CONSTRAINT IF EXISTS purchases_amount_positive;

-- Add the updated constraint that allows amount >= 0 (including zero for trials)
ALTER TABLE public.purchases ADD CONSTRAINT purchases_amount_positive CHECK (amount >= 0);
