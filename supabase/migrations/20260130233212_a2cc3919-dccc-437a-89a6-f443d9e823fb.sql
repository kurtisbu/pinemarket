-- Create a SECURITY DEFINER function to get user's Stripe status
-- This keeps stripe_account_id server-side while exposing only necessary status flags
CREATE OR REPLACE FUNCTION public.get_user_stripe_status()
RETURNS TABLE(
  has_stripe_account BOOLEAN,
  onboarding_completed BOOLEAN,
  charges_enabled BOOLEAN,
  payouts_enabled BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (p.stripe_account_id IS NOT NULL) AS has_stripe_account,
    COALESCE(p.stripe_onboarding_completed, false) AS onboarding_completed,
    COALESCE(p.stripe_charges_enabled, false) AS charges_enabled,
    COALESCE(p.stripe_payouts_enabled, false) AS payouts_enabled
  FROM public.profiles p
  WHERE p.id = auth.uid();
END;
$$;