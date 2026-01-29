-- =====================================================
-- SECURITY FIX: Warn-level issues remediation
-- =====================================================

-- 1. Fix functions without search_path (handle_rating_change, handle_updated_at)

CREATE OR REPLACE FUNCTION public.handle_rating_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY INVOKER
 SET search_path = public
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM update_program_rating_stats(OLD.program_id);
    RETURN OLD;
  ELSE
    PERFORM update_program_rating_stats(NEW.program_id);
    RETURN NEW;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY INVOKER
 SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- 2. Fix overly permissive RLS policies - restrict to service_role only

-- assignment_logs: Fix service policies
DROP POLICY IF EXISTS "Service can insert assignment logs" ON public.assignment_logs;
CREATE POLICY "Service can insert assignment logs"
ON public.assignment_logs
FOR INSERT
TO service_role
WITH CHECK (true);

DROP POLICY IF EXISTS "Service can update assignment logs" ON public.assignment_logs;
CREATE POLICY "Service can update assignment logs"
ON public.assignment_logs
FOR UPDATE
TO service_role
USING (true);

-- payouts: Fix service policy
DROP POLICY IF EXISTS "Service can manage payouts" ON public.payouts;
CREATE POLICY "Service can manage payouts"
ON public.payouts
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- purchases: Fix service policies
DROP POLICY IF EXISTS "Service can insert purchases" ON public.purchases;
CREATE POLICY "Service can insert purchases"
ON public.purchases
FOR INSERT
TO service_role
WITH CHECK (true);

DROP POLICY IF EXISTS "Service can update purchases" ON public.purchases;
CREATE POLICY "Service can update purchases"
ON public.purchases
FOR UPDATE
TO service_role
USING (true);

-- rate_limits: Fix service policy and remove user access to IP addresses
DROP POLICY IF EXISTS "Service can manage rate limits" ON public.rate_limits;
CREATE POLICY "Service can manage rate limits"
ON public.rate_limits
FOR ALL
TO service_role
USING (true);

-- Remove user access to rate_limits (security fix: hide IP addresses from users)
DROP POLICY IF EXISTS "Users can view their own rate limits" ON public.rate_limits;

-- Add admin-only access for rate_limits viewing
CREATE POLICY "Admins can view all rate limits"
ON public.rate_limits
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- script_assignments: Fix service policies
DROP POLICY IF EXISTS "Service can insert script assignments" ON public.script_assignments;
CREATE POLICY "Service can insert script assignments"
ON public.script_assignments
FOR INSERT
TO service_role
WITH CHECK (true);

DROP POLICY IF EXISTS "Service can update script assignments" ON public.script_assignments;
CREATE POLICY "Service can update script assignments"
ON public.script_assignments
FOR UPDATE
TO service_role
USING (true);

-- security_audit_logs: Fix service policy
DROP POLICY IF EXISTS "Service can insert security audit logs" ON public.security_audit_logs;
CREATE POLICY "Service can insert security audit logs"
ON public.security_audit_logs
FOR INSERT
TO service_role
WITH CHECK (true);

-- seller_access_codes: Fix service policy
DROP POLICY IF EXISTS "Service can update code usage" ON public.seller_access_codes;
CREATE POLICY "Service can update code usage"
ON public.seller_access_codes
FOR UPDATE
TO service_role
USING (true);

-- seller_balances: Fix service policy
DROP POLICY IF EXISTS "Service can manage seller balances" ON public.seller_balances;
CREATE POLICY "Service can manage seller balances"
ON public.seller_balances
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- subscription_access: Fix service policy
DROP POLICY IF EXISTS "Service can manage subscription access" ON public.subscription_access;
CREATE POLICY "Service can manage subscription access"
ON public.subscription_access
FOR ALL
TO service_role
USING (true);

-- trial_usage: Fix service policies
DROP POLICY IF EXISTS "Service can insert trial usage" ON public.trial_usage;
CREATE POLICY "Service can insert trial usage"
ON public.trial_usage
FOR INSERT
TO service_role
WITH CHECK (true);

DROP POLICY IF EXISTS "Service can update trial usage" ON public.trial_usage;
CREATE POLICY "Service can update trial usage"
ON public.trial_usage
FOR UPDATE
TO service_role
USING (true);

-- user_subscriptions: Fix service policy
DROP POLICY IF EXISTS "Service can manage subscriptions" ON public.user_subscriptions;
CREATE POLICY "Service can manage subscriptions"
ON public.user_subscriptions
FOR ALL
TO service_role
USING (true);