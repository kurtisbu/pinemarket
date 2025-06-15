
-- Phase 1: Database Schema Updates for TradingView Automation

-- Step 1: Extend profiles table to store TradingView credentials
ALTER TABLE public.profiles
ADD COLUMN tradingview_username TEXT,
ADD COLUMN tradingview_session_cookie TEXT,
ADD COLUMN tradingview_signed_session_cookie TEXT,
ADD COLUMN is_tradingview_connected BOOLEAN NOT NULL DEFAULT FALSE;

-- Step 2: Create enum types for statuses
CREATE TYPE public.purchase_status AS ENUM ('pending', 'completed', 'failed', 'refunded');
CREATE TYPE public.assignment_status AS ENUM ('pending', 'assigned', 'failed', 'expired');

-- Step 3: Create purchases table
CREATE TABLE public.purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id UUID NOT NULL REFERENCES public.programs(id),
    buyer_id UUID NOT NULL REFERENCES public.profiles(id),
    seller_id UUID NOT NULL REFERENCES public.profiles(id),
    amount NUMERIC(10, 2) NOT NULL,
    status public.purchase_status NOT NULL DEFAULT 'pending',
    payment_intent_id TEXT, -- For Stripe integration
    purchased_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX idx_purchases_program_id ON public.purchases(program_id);
CREATE INDEX idx_purchases_buyer_id ON public.purchases(buyer_id);
CREATE INDEX idx_purchases_seller_id ON public.purchases(seller_id);

-- Add RLS to purchases table
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;

-- Policy: Buyers can see their own purchases.
CREATE POLICY "Buyers can see their own purchases"
ON public.purchases FOR SELECT
USING (auth.uid() = buyer_id);

-- Policy: Sellers can see purchases of their programs.
CREATE POLICY "Sellers can see purchases of their programs"
ON public.purchases FOR SELECT
USING (auth.uid() = seller_id);
-- No INSERT, UPDATE, or DELETE policies for users. These actions should be handled by backend logic (Edge Functions).

-- Trigger for purchases updated_at
CREATE TRIGGER handle_purchases_updated_at
BEFORE UPDATE ON public.purchases
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();


-- Step 4: Create script_assignments table
CREATE TABLE public.script_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_id UUID UNIQUE NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
    program_id UUID NOT NULL REFERENCES public.programs(id),
    buyer_id UUID NOT NULL REFERENCES public.profiles(id),
    seller_id UUID NOT NULL REFERENCES public.profiles(id),
    tradingview_script_id TEXT, -- From the 'programs' table link
    status public.assignment_status NOT NULL DEFAULT 'pending',
    assigned_at TIMESTAMPTZ,
    error_message TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX idx_script_assignments_purchase_id ON public.script_assignments(purchase_id);
CREATE INDEX idx_script_assignments_program_id ON public.script_assignments(program_id);
CREATE INDEX idx_script_assignments_buyer_id ON public.script_assignments(buyer_id);
CREATE INDEX idx_script_assignments_seller_id ON public.script_assignments(seller_id);
CREATE INDEX idx_script_assignments_status ON public.script_assignments(status);

-- Add RLS to script_assignments table
ALTER TABLE public.script_assignments ENABLE ROW LEVEL SECURITY;

-- Policy: Buyers can see their own script assignments.
CREATE POLICY "Buyers can view their own script assignments"
ON public.script_assignments FOR SELECT
USING (auth.uid() = buyer_id);

-- Policy: Sellers can see script assignments for their programs.
CREATE POLICY "Sellers can view script assignments for their programs"
ON public.script_assignments FOR SELECT
USING (auth.uid() = seller_id);
-- No INSERT, UPDATE, or DELETE policies for users. These actions should be handled by backend logic (Edge Functions).

-- Trigger for script_assignments updated_at
CREATE TRIGGER handle_script_assignments_updated_at
BEFORE UPDATE ON public.script_assignments
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();
