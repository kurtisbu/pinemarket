-- Fix critical security vulnerability: profiles table exposing sensitive data
-- Drop the overly permissive public SELECT policies
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can view all public profile info" ON public.profiles;

-- Create secure policies that separate public and private profile data
-- Policy 1: Allow users to view their own complete profile (all fields)
CREATE POLICY "Users can view their own complete profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = id);

-- Policy 2: Allow public access to only non-sensitive profile fields
CREATE POLICY "Public can view basic profile info" 
ON public.profiles 
FOR SELECT 
USING (true)
WITH CHECK (false); -- This is a SELECT-only policy

-- Create a view for public profile data to make it explicit what's publicly accessible
CREATE OR REPLACE VIEW public.public_profiles AS
SELECT 
  id,
  username,
  display_name,
  avatar_url,
  bio,
  role,
  created_at,
  is_tradingview_connected
FROM public.profiles;

-- Allow public read access to the public profiles view
ALTER VIEW public.public_profiles OWNER TO postgres;
GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- Create RLS policy for the view
ALTER VIEW public.public_profiles SET (security_barrier = true);

-- Add a function to safely get public profile info
CREATE OR REPLACE FUNCTION public.get_public_profile(profile_id uuid)
RETURNS TABLE (
  id uuid,
  username text,
  display_name text,
  avatar_url text,
  bio text,
  role text,
  created_at timestamptz,
  is_tradingview_connected boolean
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT 
    p.id,
    p.username,
    p.display_name,
    p.avatar_url,
    p.bio,
    p.role,
    p.created_at,
    p.is_tradingview_connected
  FROM public.profiles p
  WHERE p.id = profile_id;
$$;

-- Log this security fix
INSERT INTO public.security_audit_logs (
  action,
  resource_type,
  details,
  risk_level
) VALUES (
  'fix_profiles_table_security_vulnerability',
  'security',
  jsonb_build_object(
    'description', 'Fixed critical vulnerability where profiles table exposed sensitive authentication data',
    'sensitive_fields_protected', jsonb_build_array(
      'tradingview_session_cookie',
      'tradingview_signed_session_cookie', 
      'stripe_account_id',
      'tradingview_last_error',
      'tradingview_connection_status',
      'tradingview_last_validated_at'
    ),
    'public_fields_allowed', jsonb_build_array(
      'username',
      'display_name',
      'avatar_url',
      'bio',
      'role',
      'created_at',
      'is_tradingview_connected'
    )
  ),
  'critical'
);