
UPDATE public.profiles SET
  stripe_account_id = NULL,
  stripe_onboarding_completed = false,
  stripe_charges_enabled = false,
  stripe_payouts_enabled = false
WHERE stripe_account_id IS NOT NULL
   OR stripe_onboarding_completed = true
   OR stripe_charges_enabled = true
   OR stripe_payouts_enabled = true;

UPDATE public.programs SET
  stripe_product_id = NULL,
  stripe_monthly_price_id = NULL,
  stripe_yearly_price_id = NULL
WHERE stripe_product_id IS NOT NULL
   OR stripe_monthly_price_id IS NOT NULL
   OR stripe_yearly_price_id IS NOT NULL;

UPDATE public.program_prices SET
  stripe_price_id = NULL,
  stripe_buyer_inclusive_price_id = NULL
WHERE stripe_price_id IS NOT NULL
   OR stripe_buyer_inclusive_price_id IS NOT NULL;

UPDATE public.package_prices SET
  stripe_price_id = NULL,
  stripe_buyer_inclusive_price_id = NULL
WHERE stripe_price_id IS NOT NULL
   OR stripe_buyer_inclusive_price_id IS NOT NULL;

UPDATE public.subscription_plans SET
  stripe_price_id = NULL
WHERE stripe_price_id IS NOT NULL;
