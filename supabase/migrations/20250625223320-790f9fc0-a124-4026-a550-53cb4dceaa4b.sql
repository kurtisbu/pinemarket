
-- Phase 1: Storage Policy Cleanup and Rate Limit Config Security Fix

-- 1. Remove the public access policy for rate limit configs (security fix)
DROP POLICY IF EXISTS "Anyone can view rate limit configs" ON public.rate_limit_configs;

-- 2. Ensure only admins can view rate limit configs
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'rate_limit_configs' 
        AND policyname = 'Admins can view rate limit configs'
    ) THEN
        CREATE POLICY "Admins can view rate limit configs" ON public.rate_limit_configs
          FOR SELECT USING (
            EXISTS (
              SELECT 1 FROM public.profiles 
              WHERE id = auth.uid() 
              AND role = 'admin'
            )
          );
    END IF;
END $$;

-- 3. Clean up any potential duplicate storage policies for scripts bucket
DROP POLICY IF EXISTS "Users can access scripts bucket" ON storage.objects;
DROP POLICY IF EXISTS "Public access to scripts" ON storage.objects;

-- 4. Ensure consistent pine-scripts bucket policies only
-- (The existing policies for pine-scripts are already secure and properly implemented)

-- 5. Add enhanced input validation function for URLs
CREATE OR REPLACE FUNCTION public.validate_tradingview_url(url TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if URL is from TradingView domain
  IF url IS NULL OR url = '' THEN
    RETURN FALSE;
  END IF;
  
  -- Basic TradingView URL pattern validation
  IF url ~* '^https://www\.tradingview\.com/(script|chart)/' THEN
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$;

-- 6. Add content sanitization function
CREATE OR REPLACE FUNCTION public.sanitize_user_content(content TEXT, max_length INTEGER DEFAULT 1000)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF content IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Remove potential XSS patterns and limit length
  content := regexp_replace(content, '<[^>]*>', '', 'g'); -- Remove HTML tags
  content := regexp_replace(content, 'javascript:', '', 'gi'); -- Remove javascript: URLs
  content := regexp_replace(content, 'data:', '', 'gi'); -- Remove data: URLs
  content := left(content, max_length); -- Limit length
  
  RETURN trim(content);
END;
$$;

-- 7. Add trigger to validate and sanitize program data on insert/update
CREATE OR REPLACE FUNCTION public.validate_program_data()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Validate and sanitize title
  NEW.title := public.sanitize_user_content(NEW.title, 200);
  
  -- Validate and sanitize description
  NEW.description := public.sanitize_user_content(NEW.description, 5000);
  
  -- Validate TradingView publication URL if provided
  IF NEW.tradingview_publication_url IS NOT NULL 
     AND NOT public.validate_tradingview_url(NEW.tradingview_publication_url) THEN
    RAISE EXCEPTION 'Invalid TradingView publication URL format';
  END IF;
  
  -- Log security event for program modification
  PERFORM public.log_security_event(
    'program_data_validation',
    'program',
    NEW.id::text,
    jsonb_build_object(
      'title_length', length(NEW.title),
      'description_length', length(NEW.description),
      'has_tradingview_url', (NEW.tradingview_publication_url IS NOT NULL)
    ),
    'low'
  );
  
  RETURN NEW;
END;
$$;

-- Create trigger for program validation
DROP TRIGGER IF EXISTS validate_program_data_trigger ON public.programs;
CREATE TRIGGER validate_program_data_trigger
  BEFORE INSERT OR UPDATE ON public.programs
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_program_data();

-- 8. Update rate limit configurations for better security
UPDATE public.rate_limit_configs 
SET 
  requests_per_hour = 5,
  requests_per_minute = 1,
  burst_limit = 3
WHERE endpoint = 'payment';

UPDATE public.rate_limit_configs 
SET 
  requests_per_hour = 30,
  requests_per_minute = 2,
  burst_limit = 5
WHERE endpoint = 'script-download';

-- 9. Add new rate limit config for admin actions
INSERT INTO public.rate_limit_configs (endpoint, requests_per_hour, requests_per_minute, burst_limit) 
VALUES ('admin', 100, 10, 20)
ON CONFLICT (endpoint) DO UPDATE SET
  requests_per_hour = EXCLUDED.requests_per_hour,
  requests_per_minute = EXCLUDED.requests_per_minute,
  burst_limit = EXCLUDED.burst_limit;
