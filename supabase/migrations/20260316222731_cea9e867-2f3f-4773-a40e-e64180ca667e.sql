
-- Drop duplicate RLS policies on purchases table
DROP POLICY IF EXISTS "Buyers can see their own purchases" ON public.purchases;
DROP POLICY IF EXISTS "Sellers can see purchases of their programs" ON public.purchases;
DROP POLICY IF EXISTS "Users can view their own purchases as buyers" ON public.purchases;
DROP POLICY IF EXISTS "Users can view their own sales as sellers" ON public.purchases;
