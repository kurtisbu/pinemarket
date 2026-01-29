-- Create seller payout information table
CREATE TABLE IF NOT EXISTS public.seller_payout_info (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payout_method TEXT NOT NULL CHECK (payout_method IN ('bank_transfer', 'paypal')),
  bank_account_holder_name TEXT,
  bank_account_number TEXT,
  bank_routing_number TEXT,
  bank_name TEXT,
  paypal_email TEXT,
  country TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  is_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id)
);

-- Create seller balances table
CREATE TABLE IF NOT EXISTS public.seller_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  available_balance NUMERIC NOT NULL DEFAULT 0,
  pending_balance NUMERIC NOT NULL DEFAULT 0,
  total_earned NUMERIC NOT NULL DEFAULT 0,
  total_paid_out NUMERIC NOT NULL DEFAULT 0,
  last_payout_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(seller_id)
);

-- Create payouts table
CREATE TABLE IF NOT EXISTS public.payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  payout_method TEXT NOT NULL,
  stripe_transfer_id TEXT,
  failure_reason TEXT,
  initiated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add seller_owed field to purchases
ALTER TABLE public.purchases 
ADD COLUMN IF NOT EXISTS seller_owed NUMERIC DEFAULT 0;

-- Update existing purchases to calculate seller_owed (amount - platform_fee)
UPDATE public.purchases 
SET seller_owed = amount - platform_fee 
WHERE seller_owed = 0 OR seller_owed IS NULL;

-- Enable RLS
ALTER TABLE public.seller_payout_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for seller_payout_info
CREATE POLICY "Users can manage their own payout info"
  ON public.seller_payout_info
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all payout info"
  ON public.seller_payout_info
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for seller_balances
CREATE POLICY "Sellers can view their own balance"
  ON public.seller_balances
  FOR SELECT
  USING (auth.uid() = seller_id);

CREATE POLICY "Service can manage seller balances"
  ON public.seller_balances
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admins can view all balances"
  ON public.seller_balances
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for payouts
CREATE POLICY "Sellers can view their own payouts"
  ON public.payouts
  FOR SELECT
  USING (auth.uid() = seller_id);

CREATE POLICY "Service can manage payouts"
  ON public.payouts
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admins can view all payouts"
  ON public.payouts
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

-- Create function to update seller balance
CREATE OR REPLACE FUNCTION public.update_seller_balance(
  p_seller_id UUID,
  p_amount NUMERIC,
  p_type TEXT -- 'sale' or 'payout'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Insert balance record if doesn't exist
  INSERT INTO public.seller_balances (seller_id, available_balance, pending_balance, total_earned)
  VALUES (p_seller_id, 0, 0, 0)
  ON CONFLICT (seller_id) DO NOTHING;

  -- Update balance based on type
  IF p_type = 'sale' THEN
    UPDATE public.seller_balances
    SET 
      pending_balance = pending_balance + p_amount,
      total_earned = total_earned + p_amount,
      updated_at = now()
    WHERE seller_id = p_seller_id;
  ELSIF p_type = 'payout' THEN
    UPDATE public.seller_balances
    SET 
      available_balance = available_balance - p_amount,
      total_paid_out = total_paid_out + p_amount,
      last_payout_at = now(),
      updated_at = now()
    WHERE seller_id = p_seller_id;
  END IF;
END;
$$;

-- Create function to move pending to available balance
CREATE OR REPLACE FUNCTION public.settle_pending_balance(p_seller_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.seller_balances
  SET 
    available_balance = available_balance + pending_balance,
    pending_balance = 0,
    updated_at = now()
  WHERE seller_id = p_seller_id;
END;
$$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_seller_balances_seller_id ON public.seller_balances(seller_id);
CREATE INDEX IF NOT EXISTS idx_payouts_seller_id ON public.payouts(seller_id);
CREATE INDEX IF NOT EXISTS idx_payouts_status ON public.payouts(status);
CREATE INDEX IF NOT EXISTS idx_seller_payout_info_user_id ON public.seller_payout_info(user_id);

-- Add triggers for updated_at
CREATE TRIGGER update_seller_payout_info_updated_at
  BEFORE UPDATE ON public.seller_payout_info
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_seller_balances_updated_at
  BEFORE UPDATE ON public.seller_balances
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_payouts_updated_at
  BEFORE UPDATE ON public.payouts
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();