-- Create helper function to get effective fee rate
CREATE OR REPLACE FUNCTION public.get_seller_fee_rate(seller_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT custom_platform_fee_percent FROM profiles WHERE id = seller_id),
    10.0
  );
$$;

-- Update toggle_creator_featured_status to accept fee parameter
CREATE OR REPLACE FUNCTION public.toggle_creator_featured_status(
  creator_id uuid, 
  featured boolean, 
  priority integer DEFAULT 0, 
  description text DEFAULT NULL,
  custom_fee_percent numeric DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Access denied: Admin role required';
  END IF;
  
  UPDATE public.profiles
  SET 
    is_featured = featured,
    featured_at = CASE WHEN featured THEN now() ELSE NULL END,
    featured_priority = CASE WHEN featured THEN priority ELSE 0 END,
    featured_description = CASE WHEN featured THEN description ELSE NULL END,
    custom_platform_fee_percent = CASE WHEN featured THEN custom_fee_percent ELSE NULL END
  WHERE id = creator_id;
  
  PERFORM public.log_security_event(
    'toggle_creator_featured_status',
    'profile',
    creator_id::text,
    jsonb_build_object(
      'featured', featured,
      'priority', priority,
      'description', description,
      'custom_fee_percent', custom_fee_percent
    ),
    'low'
  );
END;
$$;

-- Drop and recreate get_featured_creators_with_stats with new return type
DROP FUNCTION IF EXISTS public.get_featured_creators_with_stats();

CREATE FUNCTION public.get_featured_creators_with_stats()
RETURNS TABLE(
  id uuid, 
  username text, 
  display_name text, 
  avatar_url text, 
  bio text, 
  role text, 
  created_at timestamp with time zone, 
  is_tradingview_connected boolean, 
  is_featured boolean, 
  featured_at timestamp with time zone, 
  featured_priority integer, 
  featured_description text, 
  custom_platform_fee_percent numeric,
  total_programs bigint, 
  avg_rating numeric, 
  total_sales bigint, 
  total_revenue numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
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
    p.custom_platform_fee_percent,
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