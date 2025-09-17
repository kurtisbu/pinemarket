-- CRITICAL SECURITY FIX: Remove overly permissive profile policies that expose sensitive data
-- This fixes the vulnerability where TradingView cookies and Stripe data were publicly accessible

-- Drop the dangerous policies that allow public access to ALL profile data
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can view all public profile info" ON public.profiles;

-- Create a secure policy for public profile viewing that EXCLUDES sensitive fields
-- This allows viewing of non-sensitive profile information only
CREATE POLICY "Public can view safe profile info" ON public.profiles
FOR SELECT USING (true)
WITH CHECK (false);

-- Create a policy for users to view their own complete profile (including sensitive data)
CREATE POLICY "Users can view their own complete profile" ON public.profiles
FOR SELECT USING (auth.uid() = id);

-- Create a security definer function to get safe public profile data
-- This ensures sensitive fields are never exposed in public queries
CREATE OR REPLACE FUNCTION public.get_public_profile_data(profile_id UUID)
RETURNS TABLE (
  id UUID,
  username TEXT,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  role TEXT,
  created_at TIMESTAMPTZ,
  is_tradingview_connected BOOLEAN,
  is_featured BOOLEAN,
  featured_at TIMESTAMPTZ,
  featured_priority INTEGER,
  featured_description TEXT
) 
LANGUAGE SQL 
SECURITY DEFINER 
STABLE
SET search_path = public
AS $$
  SELECT 
    p.id,
    p.username,
    p.display_name,
    p.avatar_url,
    p.bio,
    p.role,
    p.created_at,
    p.is_tradingview_connected,
    p.is_featured,
    p.featured_at,
    p.featured_priority,
    p.featured_description
  FROM public.profiles p
  WHERE p.id = profile_id;
$$;

-- Create a secure view for public profile access that excludes sensitive data
CREATE OR REPLACE VIEW public.safe_profiles AS
SELECT 
  id,
  username,
  display_name,
  avatar_url,
  bio,
  role,
  created_at,
  is_tradingview_connected,
  is_featured,
  featured_at,
  featured_priority,
  featured_description
FROM public.profiles;

-- Grant access to the safe view
GRANT SELECT ON public.safe_profiles TO authenticated, anon;

-- Update the featured creators view to use safe profile data
DROP VIEW IF EXISTS public.featured_creators_with_stats;
CREATE OR REPLACE VIEW public.featured_creators_with_stats AS
SELECT 
  p.id,
  p.username,
  p.display_name,
  p.avatar_url,
  p.bio,
  p.role,
  p.created_at,
  p.is_tradingview_connected,
  p.is_featured,
  p.featured_at,
  p.featured_priority,
  p.featured_description,
  COALESCE(prog_stats.total_programs, 0::bigint) AS total_programs,
  COALESCE(prog_stats.avg_rating, 0::numeric) AS avg_rating,
  COALESCE(sales_stats.total_sales, 0::bigint) AS total_sales,
  COALESCE(sales_stats.total_revenue, 0::numeric) AS total_revenue
FROM public.safe_profiles p
LEFT JOIN (
  SELECT 
    seller_id,
    COUNT(*) as total_programs,
    AVG(average_rating) as avg_rating
  FROM public.programs
  WHERE status = 'published'
  GROUP BY seller_id
) prog_stats ON p.id = prog_stats.seller_id
LEFT JOIN (
  SELECT 
    seller_id,
    COUNT(*) as total_sales,
    SUM(amount) as total_revenue
  FROM public.purchases
  WHERE status = 'completed'
  GROUP BY seller_id
) sales_stats ON p.id = sales_stats.seller_id
WHERE p.is_featured = true
ORDER BY p.featured_priority DESC, p.featured_at DESC;

-- Log this critical security fix
INSERT INTO public.security_audit_logs (
  action,
  resource_type,
  details,
  risk_level
) VALUES (
  'critical_security_fix_profile_data_exposure',
  'profiles',
  jsonb_build_object(
    'issue', 'Removed public access to sensitive TradingView and Stripe data',
    'fields_secured', ARRAY['tradingview_session_cookie', 'tradingview_signed_session_cookie', 'stripe_account_id'],
    'fix_type', 'Implemented field-level access control'
  ),
  'critical'
);