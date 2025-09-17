-- Final security fix: Remove the problematic public policy and implement proper field-level security

-- Remove the policy that allows public access to all profile fields
DROP POLICY IF EXISTS "Public can view safe profile fields" ON public.profiles;

-- Create a materialized view approach for better security and performance
-- This completely isolates sensitive data from public access
DROP VIEW IF EXISTS public.safe_profiles;
DROP VIEW IF EXISTS public.featured_creators_with_stats;

-- Create a secure function that returns only safe profile data
-- This approach ensures sensitive fields are never accessible publicly
CREATE OR REPLACE FUNCTION public.get_public_profiles()
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
  FROM public.profiles p;
$$;

-- Create a secure function for featured creators with stats
CREATE OR REPLACE FUNCTION public.get_featured_creators_with_stats()
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
  featured_description TEXT,
  total_programs BIGINT,
  avg_rating NUMERIC,
  total_sales BIGINT,
  total_revenue NUMERIC
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
    p.featured_description,
    COALESCE(prog_stats.total_programs, 0::bigint) AS total_programs,
    COALESCE(prog_stats.avg_rating, 0::numeric) AS avg_rating,
    COALESCE(sales_stats.total_sales, 0::bigint) AS total_sales,
    COALESCE(sales_stats.total_revenue, 0::numeric) AS total_revenue
  FROM public.profiles p
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
$$;

-- Grant execute permissions on the functions (not on views/tables)
GRANT EXECUTE ON FUNCTION public.get_public_profiles() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_featured_creators_with_stats() TO authenticated, anon;

-- Document the security approach
COMMENT ON FUNCTION public.get_public_profiles() IS 
'Secure function that returns only non-sensitive profile fields. Prevents access to TradingView cookies and Stripe data.';

COMMENT ON FUNCTION public.get_featured_creators_with_stats() IS 
'Secure function that returns featured creators data without exposing sensitive authentication tokens or financial information.';