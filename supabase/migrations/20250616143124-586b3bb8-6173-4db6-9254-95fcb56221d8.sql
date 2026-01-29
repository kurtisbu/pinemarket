
-- Add Stripe Connect fields to profiles table
ALTER TABLE public.profiles 
ADD COLUMN stripe_account_id TEXT,
ADD COLUMN stripe_onboarding_completed BOOLEAN DEFAULT FALSE,
ADD COLUMN stripe_charges_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN stripe_payouts_enabled BOOLEAN DEFAULT FALSE;

-- Create purchases table if it doesn't exist (for tracking payments)
CREATE TABLE IF NOT EXISTS public.purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID NOT NULL REFERENCES public.profiles(id),
  seller_id UUID NOT NULL REFERENCES public.profiles(id),
  program_id UUID NOT NULL REFERENCES public.programs(id),
  amount DECIMAL(10,2) NOT NULL,
  platform_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
  stripe_payment_intent_id TEXT,
  stripe_transfer_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on purchases table
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;

-- Create policies for purchases table
CREATE POLICY "Users can view their own purchases as buyers" ON public.purchases
  FOR SELECT USING (buyer_id = auth.uid());

CREATE POLICY "Users can view their own sales as sellers" ON public.purchases
  FOR SELECT USING (seller_id = auth.uid());

-- Create updated_at trigger for purchases
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.purchases
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();
