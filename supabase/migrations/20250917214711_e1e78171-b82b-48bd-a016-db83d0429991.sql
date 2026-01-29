-- Add Stripe product and price IDs to programs table for seller-specific subscriptions
ALTER TABLE public.programs 
ADD COLUMN stripe_product_id TEXT,
ADD COLUMN stripe_monthly_price_id TEXT,
ADD COLUMN stripe_yearly_price_id TEXT;