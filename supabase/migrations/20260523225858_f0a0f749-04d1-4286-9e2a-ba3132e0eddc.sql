
-- Drop the overly permissive public SELECT policy on profiles
DROP POLICY IF EXISTS "Anyone can view public profile fields" ON public.profiles;

-- Allow admins to view all profiles (needed for admin dashboards)
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Safe public lookup by username
CREATE OR REPLACE FUNCTION public.get_safe_profile_by_username(_username text)
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
  featured_description text
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
    p.featured_description
  FROM public.profiles p
  WHERE p.username = _username
  LIMIT 1;
$$;
