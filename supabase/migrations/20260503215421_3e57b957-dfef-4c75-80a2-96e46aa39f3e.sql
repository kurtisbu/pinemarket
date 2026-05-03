
-- 1. Lower default seller fee from 10% to 5%
CREATE OR REPLACE FUNCTION public.get_seller_fee_rate(seller_id uuid)
 RETURNS numeric
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (SELECT custom_platform_fee_percent FROM profiles WHERE id = seller_id),
    5.0
  );
$function$;

-- 2. Cache for buyer-inclusive Stripe Price objects
ALTER TABLE public.program_prices
  ADD COLUMN IF NOT EXISTS stripe_buyer_inclusive_price_id text;

ALTER TABLE public.package_prices
  ADD COLUMN IF NOT EXISTS stripe_buyer_inclusive_price_id text;

-- 3. Track buyer-side fee and total charged on each purchase
ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS buyer_fee numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_charged numeric;
