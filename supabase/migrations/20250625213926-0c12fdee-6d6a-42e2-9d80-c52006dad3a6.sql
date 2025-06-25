
-- Drop existing policies first to avoid conflicts, then recreate all needed policies
DROP POLICY IF EXISTS "Users can view all public profile info" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;

-- RLS Policies for profiles table
CREATE POLICY "Users can view all public profile info" ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Drop existing program policies if they exist
DROP POLICY IF EXISTS "Everyone can view published programs" ON public.programs;
DROP POLICY IF EXISTS "Sellers can view their own programs" ON public.programs;
DROP POLICY IF EXISTS "Sellers can create programs" ON public.programs;
DROP POLICY IF EXISTS "Sellers can update their own programs" ON public.programs;
DROP POLICY IF EXISTS "Sellers can delete their own programs" ON public.programs;

-- RLS Policies for programs table
CREATE POLICY "Everyone can view published programs" ON public.programs
  FOR SELECT USING (status = 'published');

CREATE POLICY "Sellers can view their own programs" ON public.programs
  FOR SELECT USING (auth.uid() = seller_id);

CREATE POLICY "Sellers can create programs" ON public.programs
  FOR INSERT WITH CHECK (auth.uid() = seller_id);

CREATE POLICY "Sellers can update their own programs" ON public.programs
  FOR UPDATE USING (auth.uid() = seller_id);

CREATE POLICY "Sellers can delete their own programs" ON public.programs
  FOR DELETE USING (auth.uid() = seller_id);

-- Drop existing purchase policies if they exist
DROP POLICY IF EXISTS "Buyers can view their own purchases" ON public.purchases;
DROP POLICY IF EXISTS "Sellers can view purchases of their programs" ON public.purchases;
DROP POLICY IF EXISTS "Service can insert purchases" ON public.purchases;
DROP POLICY IF EXISTS "Service can update purchases" ON public.purchases;

-- RLS Policies for purchases table
CREATE POLICY "Buyers can view their own purchases" ON public.purchases
  FOR SELECT USING (auth.uid() = buyer_id);

CREATE POLICY "Sellers can view purchases of their programs" ON public.purchases
  FOR SELECT USING (auth.uid() = seller_id);

-- Service role can insert purchases (for payment processing)
CREATE POLICY "Service can insert purchases" ON public.purchases
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Service can update purchases" ON public.purchases
  FOR UPDATE USING (true);

-- Drop existing script assignment policies if they exist
DROP POLICY IF EXISTS "Buyers can view their own script assignments" ON public.script_assignments;
DROP POLICY IF EXISTS "Sellers can view script assignments for their programs" ON public.script_assignments;
DROP POLICY IF EXISTS "Service can insert script assignments" ON public.script_assignments;
DROP POLICY IF EXISTS "Service can update script assignments" ON public.script_assignments;

-- RLS Policies for script_assignments table
CREATE POLICY "Buyers can view their own script assignments" ON public.script_assignments
  FOR SELECT USING (auth.uid() = buyer_id);

CREATE POLICY "Sellers can view script assignments for their programs" ON public.script_assignments
  FOR SELECT USING (auth.uid() = seller_id);

-- Service role can manage script assignments (for automation)
CREATE POLICY "Service can insert script assignments" ON public.script_assignments
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Service can update script assignments" ON public.script_assignments
  FOR UPDATE USING (true);

-- Drop existing tradingview_scripts policy if it exists
DROP POLICY IF EXISTS "Users can manage their own TradingView scripts" ON public.tradingview_scripts;

-- RLS Policies for tradingview_scripts table
CREATE POLICY "Users can manage their own TradingView scripts" ON public.tradingview_scripts
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Add data validation constraints for security (only if they don't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints 
        WHERE constraint_name = 'programs_price_positive'
    ) THEN
        ALTER TABLE public.programs 
        ADD CONSTRAINT programs_price_positive CHECK (price >= 0);
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints 
        WHERE constraint_name = 'programs_status_valid'
    ) THEN
        ALTER TABLE public.programs 
        ADD CONSTRAINT programs_status_valid CHECK (status IN ('draft', 'published', 'archived'));
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints 
        WHERE constraint_name = 'purchases_amount_positive'
    ) THEN
        ALTER TABLE public.purchases 
        ADD CONSTRAINT purchases_amount_positive CHECK (amount > 0);
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints 
        WHERE constraint_name = 'purchases_platform_fee_non_negative'
    ) THEN
        ALTER TABLE public.purchases 
        ADD CONSTRAINT purchases_platform_fee_non_negative CHECK (platform_fee >= 0);
    END IF;
END $$;
