
-- Revoke from anonymous role: these are not for public consumption
REVOKE SELECT (
  stripe_account_id,
  stripe_onboarding_completed,
  stripe_charges_enabled,
  stripe_payouts_enabled,
  custom_platform_fee_percent,
  tradingview_cookies_set_at,
  tradingview_last_error,
  tradingview_last_validated_at,
  tradingview_connection_status
) ON public.profiles FROM anon;
