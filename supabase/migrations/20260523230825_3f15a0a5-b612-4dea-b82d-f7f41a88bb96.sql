
DO $$
DECLARE
  admin_id uuid := '0868c813-aad6-45fe-aa9e-c7812d607e44';
BEGIN
  -- Child / dependent rows first
  DELETE FROM public.assignment_logs WHERE assignment_id IN (SELECT id FROM public.script_assignments WHERE buyer_id <> admin_id AND seller_id <> admin_id);
  DELETE FROM public.script_assignments WHERE buyer_id <> admin_id AND seller_id <> admin_id;
  DELETE FROM public.subscription_access WHERE user_subscription_id IN (SELECT id FROM public.user_subscriptions WHERE user_id <> admin_id);
  DELETE FROM public.user_subscriptions WHERE user_id <> admin_id;
  DELETE FROM public.trial_usage WHERE user_id <> admin_id;
  DELETE FROM public.ratings WHERE user_id <> admin_id;
  DELETE FROM public.purchases WHERE buyer_id <> admin_id AND seller_id <> admin_id;

  DELETE FROM public.program_scripts WHERE program_id IN (SELECT id FROM public.programs WHERE seller_id <> admin_id);
  DELETE FROM public.program_prices WHERE program_id IN (SELECT id FROM public.programs WHERE seller_id <> admin_id);
  DELETE FROM public.package_programs WHERE package_id IN (SELECT id FROM public.program_packages WHERE seller_id <> admin_id)
     OR program_id IN (SELECT id FROM public.programs WHERE seller_id <> admin_id);
  DELETE FROM public.package_prices WHERE package_id IN (SELECT id FROM public.program_packages WHERE seller_id <> admin_id);
  DELETE FROM public.programs WHERE seller_id <> admin_id;
  DELETE FROM public.program_packages WHERE seller_id <> admin_id;

  DELETE FROM public.tradingview_scripts WHERE user_id <> admin_id;
  DELETE FROM public.seller_balances WHERE seller_id <> admin_id;
  DELETE FROM public.payouts WHERE seller_id <> admin_id;
  DELETE FROM public.seller_payout_info WHERE user_id <> admin_id;
  DELETE FROM public.seller_notifications WHERE user_id <> admin_id;
  DELETE FROM public.support_ticket_messages WHERE ticket_id IN (SELECT id FROM public.support_tickets WHERE user_id IS NULL OR user_id <> admin_id);
  DELETE FROM public.support_tickets WHERE user_id IS NULL OR user_id <> admin_id;
  DELETE FROM public.seller_access_codes WHERE used_by_user_id IS NULL OR used_by_user_id <> admin_id;

  DELETE FROM public.user_roles WHERE user_id <> admin_id;
  DELETE FROM public.profiles WHERE id <> admin_id;

  -- Test noise
  DELETE FROM public.rate_limits;
  DELETE FROM public.security_audit_logs;
  DELETE FROM public.interest_signups;
END $$;
