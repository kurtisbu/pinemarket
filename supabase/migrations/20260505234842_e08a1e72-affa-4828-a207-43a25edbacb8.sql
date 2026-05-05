CREATE OR REPLACE FUNCTION public.get_all_creators_with_stats()
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
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Access denied: Admin role required';
  END IF;

  RETURN QUERY
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
    SELECT seller_id,
           COUNT(*) AS total_programs,
           AVG(average_rating) AS avg_rating
    FROM public.programs
    GROUP BY seller_id
  ) prog_stats ON p.id = prog_stats.seller_id
  LEFT JOIN (
    SELECT seller_id,
           COUNT(*) AS total_sales,
           SUM(amount) AS total_revenue
    FROM public.purchases
    WHERE status = 'completed'
    GROUP BY seller_id
  ) sales_stats ON p.id = sales_stats.seller_id
  WHERE
    prog_stats.total_programs IS NOT NULL
    OR p.stripe_account_id IS NOT NULL
    OR p.is_featured = true
  ORDER BY p.is_featured DESC NULLS LAST, p.featured_priority DESC NULLS LAST, p.created_at DESC;
END;
$$;