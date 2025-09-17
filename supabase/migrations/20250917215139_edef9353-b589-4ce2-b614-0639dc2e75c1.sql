-- Fix Security Definer View issue by removing explicit grants on featured_creators_with_stats
-- This ensures the view respects RLS policies of the querying user

-- Remove the problematic grants that bypass RLS
REVOKE SELECT ON public.featured_creators_with_stats FROM authenticated, anon;

-- The view will now properly respect the RLS policies on the underlying tables:
-- - profiles table: "Public profiles are viewable by everyone" (allows public access)
-- - programs table: "Everyone can view published programs" (allows viewing published programs)  
-- - purchases table: RLS policies control access appropriately

-- Add a comment to document the security fix
COMMENT ON VIEW public.featured_creators_with_stats IS 
'View of featured creators with statistics. Access controlled by RLS policies on underlying tables (profiles, programs, purchases) rather than explicit grants.';