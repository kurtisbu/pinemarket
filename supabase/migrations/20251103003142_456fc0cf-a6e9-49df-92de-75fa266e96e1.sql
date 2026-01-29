-- ============================================================================
-- CRITICAL SECURITY FIX: Separate User Roles Table + Secure Access Codes
-- ============================================================================
-- This migration fixes two critical vulnerabilities:
-- 1. Admin role stored in user-accessible profiles table (privilege escalation)
-- 2. Seller access codes publicly readable (unauthorized access)
-- ============================================================================

-- PART 1: CREATE SECURE USER ROLES SYSTEM
-- ============================================================================

-- 1. Create enum for roles
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

-- 2. Create user_roles table with restrictive access
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE (user_id, role)
);

-- 3. Enable RLS on user_roles (very restrictive)
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 4. Only service role can manage user_roles (no public access)
CREATE POLICY "Service role can manage user roles"
ON public.user_roles
FOR ALL
USING (auth.role() = 'service_role');

-- 5. Users can view their own roles only
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

-- 6. Create SECURITY DEFINER function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  );
$$;

-- 7. Migrate existing admin users from profiles.role to user_roles
INSERT INTO public.user_roles (user_id, role, created_by)
SELECT id, 'admin'::public.app_role, id
FROM public.profiles
WHERE role = 'admin'
ON CONFLICT (user_id, role) DO NOTHING;

-- PART 2: UPDATE ALL RLS POLICIES TO USE has_role()
-- ============================================================================

-- Drop old policies that check profiles.role
DROP POLICY IF EXISTS "Admins can view all logs" ON public.assignment_logs;
DROP POLICY IF EXISTS "Admins can view rate limit configs" ON public.rate_limit_configs;
DROP POLICY IF EXISTS "Admins can manage rate limit configs" ON public.rate_limit_configs;
DROP POLICY IF EXISTS "Admins can view security audit logs" ON public.security_audit_logs;
DROP POLICY IF EXISTS "Admins can manage seller access codes" ON public.seller_access_codes;

-- Recreate policies using has_role() function
CREATE POLICY "Admins can view all logs"
ON public.assignment_logs
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view rate limit configs"
ON public.rate_limit_configs
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage rate limit configs"
ON public.rate_limit_configs
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view security audit logs"
ON public.security_audit_logs
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage seller access codes"
ON public.seller_access_codes
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Update toggle_creator_featured_status function to use has_role()
CREATE OR REPLACE FUNCTION public.toggle_creator_featured_status(
  creator_id UUID,
  featured BOOLEAN,
  priority INTEGER DEFAULT 0,
  description TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if user is admin using secure function
  IF NOT public.has_role(auth.uid(), 'admin') THEN
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

-- PART 3: SECURE SELLER ACCESS CODES
-- ============================================================================

-- Remove the public SELECT policy that exposes all codes
DROP POLICY IF EXISTS "Service can validate access codes" ON public.seller_access_codes;

-- The validation is already handled by the validate_seller_access_code() RPC function
-- which is SECURITY DEFINER and doesn't need a public SELECT policy

-- Add comment to document security
COMMENT ON TABLE public.seller_access_codes IS 
'Seller access codes for registration. Access restricted to: (1) Admins via has_role() function, (2) Server-side validation via validate_seller_access_code() RPC. No public SELECT access to prevent code enumeration attacks.';

-- PART 4: ADD HELPER FUNCTION FOR ADMIN CHECKS IN CLIENT CODE
-- ============================================================================

-- Create a function that clients can call to check if current user is admin
CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin');
$$;

-- Add helpful comments
COMMENT ON FUNCTION public.has_role(UUID, public.app_role) IS 
'Securely checks if a user has a specific role. Used in RLS policies to prevent privilege escalation attacks.';

COMMENT ON FUNCTION public.is_current_user_admin() IS 
'Checks if the current authenticated user has admin role. Safe for client-side use.';

COMMENT ON TABLE public.user_roles IS 
'Stores user roles separately from profiles to prevent privilege escalation. Only service role can INSERT/UPDATE/DELETE. Users can only SELECT their own roles.';