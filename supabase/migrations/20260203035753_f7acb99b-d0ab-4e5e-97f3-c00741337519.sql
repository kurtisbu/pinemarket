-- Add stripe_subscription_id column to purchases table for tracking subscription lifecycle
ALTER TABLE purchases 
ADD COLUMN stripe_subscription_id TEXT;

-- Index for quick lookup during renewal webhooks
CREATE INDEX idx_purchases_stripe_subscription_id 
ON purchases(stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;