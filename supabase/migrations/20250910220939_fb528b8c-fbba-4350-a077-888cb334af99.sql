-- Add featured creator columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN is_featured BOOLEAN DEFAULT FALSE,
ADD COLUMN featured_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN featured_priority INTEGER DEFAULT 0,
ADD COLUMN featured_description TEXT;

-- Create index for efficient featured creator queries
CREATE INDEX idx_profiles_featured ON public.profiles (is_featured, featured_priority DESC) WHERE is_featured = true;

-- Create view for featured creators with performance metrics
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
  COALESCE(prog_stats.total_programs, 0) as total_programs,
  COALESCE(prog_stats.avg_rating, 0) as avg_rating,
  COALESCE(sales_stats.total_sales, 0) as total_sales,
  COALESCE(sales_stats.total_revenue, 0) as total_revenue
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

-- Grant access to the view
GRANT SELECT ON public.featured_creators_with_stats TO authenticated, anon;

-- Create function to toggle featured status (admin only)
CREATE OR REPLACE FUNCTION public.toggle_creator_featured_status(
  creator_id UUID,
  featured BOOLEAN,
  priority INTEGER DEFAULT 0,
  description TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if user is admin
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access denied: Admin role required';
  END IF;
  
  -- Update the creator's featured status
  UPDATE public.profiles
  SET 
    is_featured = featured,
    featured_at = CASE WHEN featured THEN now() ELSE NULL END,
    featured_priority = CASE WHEN featured THEN priority ELSE 0 END,
    featured_description = CASE WHEN featured THEN description ELSE NULL END
  WHERE id = creator_id;
  
  -- Log the action
  PERFORM public.log_security_event(
    'toggle_creator_featured_status',
    'profile',
    creator_id::text,
    jsonb_build_object(
      'featured', featured,
      'priority', priority,
      'description', description
    ),
    'low'
  );
END;
$$;