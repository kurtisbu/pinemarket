
-- Fix the buyer_id foreign key constraint to cascade delete
ALTER TABLE public.purchases 
DROP CONSTRAINT IF EXISTS purchases_buyer_id_fkey;

ALTER TABLE public.purchases 
ADD CONSTRAINT purchases_buyer_id_fkey 
FOREIGN KEY (buyer_id) REFERENCES public.profiles(id) 
ON DELETE CASCADE;

-- Also fix the seller_id foreign key constraint to cascade delete
ALTER TABLE public.purchases 
DROP CONSTRAINT IF EXISTS purchases_seller_id_fkey;

ALTER TABLE public.purchases 
ADD CONSTRAINT purchases_seller_id_fkey 
FOREIGN KEY (seller_id) REFERENCES public.profiles(id) 
ON DELETE CASCADE;
