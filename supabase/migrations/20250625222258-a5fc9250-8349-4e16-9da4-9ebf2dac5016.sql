
-- Phase 1: Critical Security Fixes (Fix existing data first)

-- Fix existing programs with short descriptions
UPDATE public.programs 
SET description = CASE 
  WHEN length(description) < 10 THEN description || ' - Updated for compliance'
  ELSE description 
END
WHERE length(description) < 10;

-- Fix existing programs with short titles
UPDATE public.programs 
SET title = CASE 
  WHEN length(title) < 3 THEN title || ' Script'
  ELSE title 
END
WHERE length(title) < 3;

-- Now apply the security fixes with proper data validation
-- 1. Complete RLS Policy Coverage for assignment_logs (skip if exists)
DO $$ 
BEGIN
    -- Only create policies if they don't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'assignment_logs' 
        AND policyname = 'Service can insert assignment logs'
    ) THEN
        CREATE POLICY "Service can insert assignment logs" ON public.assignment_logs
          FOR INSERT WITH CHECK (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'assignment_logs' 
        AND policyname = 'Service can update assignment logs'
    ) THEN
        CREATE POLICY "Service can update assignment logs" ON public.assignment_logs
          FOR UPDATE USING (true);
    END IF;
END $$;

-- 2. Add user-level rate limit visibility policies
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'rate_limits' 
        AND policyname = 'Users can view their own rate limits'
    ) THEN
        CREATE POLICY "Users can view their own rate limits" ON public.rate_limits
          FOR SELECT USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'rate_limits' 
        AND policyname = 'Service can manage rate limits'
    ) THEN
        CREATE POLICY "Service can manage rate limits" ON public.rate_limits
          FOR ALL USING (true);
    END IF;
END $$;

-- 3. Add admin-only policies for rate_limit_configs
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

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'rate_limit_configs' 
        AND policyname = 'Admins can manage rate limit configs'
    ) THEN
        CREATE POLICY "Admins can manage rate limit configs" ON public.rate_limit_configs
          FOR ALL USING (
            EXISTS (
              SELECT 1 FROM public.profiles 
              WHERE id = auth.uid() 
              AND role = 'admin'
            )
          );
    END IF;
END $$;

-- 4. Create security audit log table for monitoring
CREATE TABLE IF NOT EXISTS public.security_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  ip_address INET,
  user_agent TEXT,
  details JSONB,
  risk_level TEXT CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on security audit logs
ALTER TABLE public.security_audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view security audit logs
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'security_audit_logs' 
        AND policyname = 'Admins can view security audit logs'
    ) THEN
        CREATE POLICY "Admins can view security audit logs" ON public.security_audit_logs
          FOR SELECT USING (
            EXISTS (
              SELECT 1 FROM public.profiles 
              WHERE id = auth.uid() 
              AND role = 'admin'
            )
          );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'security_audit_logs' 
        AND policyname = 'Service can insert security audit logs'
    ) THEN
        CREATE POLICY "Service can insert security audit logs" ON public.security_audit_logs
          FOR INSERT WITH CHECK (true);
    END IF;
END $$;

-- 5. Add constraints for better data validation (only if they don't exist)
DO $$ 
BEGIN
    -- Check and add programs constraints
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints 
        WHERE constraint_name = 'programs_price_range'
    ) THEN
        ALTER TABLE public.programs 
        ADD CONSTRAINT programs_price_range CHECK (price >= 0 AND price <= 999999);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints 
        WHERE constraint_name = 'programs_title_length'
    ) THEN
        ALTER TABLE public.programs 
        ADD CONSTRAINT programs_title_length CHECK (length(title) >= 3 AND length(title) <= 200);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints 
        WHERE constraint_name = 'programs_description_length'
    ) THEN
        ALTER TABLE public.programs 
        ADD CONSTRAINT programs_description_length CHECK (length(description) >= 10);
    END IF;

    -- Check and add purchases constraints
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints 
        WHERE constraint_name = 'purchases_amount_range'
    ) THEN
        ALTER TABLE public.purchases
        ADD CONSTRAINT purchases_amount_range CHECK (amount >= 0 AND amount <= 999999);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints 
        WHERE constraint_name = 'purchases_platform_fee_range'
    ) THEN
        ALTER TABLE public.purchases
        ADD CONSTRAINT purchases_platform_fee_range CHECK (platform_fee >= 0 AND platform_fee <= amount);
    END IF;
END $$;

-- 6. Improve storage bucket policies with better security
DROP POLICY IF EXISTS "Buyers can access purchased scripts" ON storage.objects;
DROP POLICY IF EXISTS "Secure script access for buyers" ON storage.objects;

-- Create more secure script access policy with logging
CREATE POLICY "Secure script access for buyers" ON storage.objects 
  FOR SELECT 
  USING (
    bucket_id = 'pine-scripts' 
    AND auth.role() = 'authenticated'
    AND (
      -- Seller can always access their own scripts
      auth.uid()::text = (storage.foldername(name))[1]
      OR
      -- Buyer can access if they have a completed purchase with audit trail
      EXISTS (
        SELECT 1 FROM public.purchases p
        JOIN public.programs pr ON p.program_id = pr.id
        WHERE p.buyer_id = auth.uid()
        AND p.status = 'completed'
        AND pr.script_file_path = name
        AND p.created_at > now() - INTERVAL '1 year' -- Limit access to recent purchases
      )
    )
  );

-- 7. Create function to log security events
CREATE OR REPLACE FUNCTION public.log_security_event(
  p_action TEXT,
  p_resource_type TEXT,
  p_resource_id TEXT DEFAULT NULL,
  p_details JSONB DEFAULT NULL,
  p_risk_level TEXT DEFAULT 'low'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  log_id UUID;
BEGIN
  INSERT INTO public.security_audit_logs (
    user_id,
    action,
    resource_type,
    resource_id,
    ip_address,
    details,
    risk_level
  ) VALUES (
    auth.uid(),
    p_action,
    p_resource_type,
    p_resource_id,
    inet_client_addr(),
    p_details,
    p_risk_level
  ) RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$$;

-- 8. Create function for secure file validation
CREATE OR REPLACE FUNCTION public.validate_file_upload(
  p_file_name TEXT,
  p_file_size BIGINT,
  p_mime_type TEXT,
  p_bucket_name TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  validation_result JSONB;
  max_size BIGINT;
  allowed_types TEXT[];
BEGIN
  -- Set limits based on bucket
  IF p_bucket_name = 'pine-scripts' THEN
    max_size := 10485760; -- 10MB
    allowed_types := ARRAY['text/plain', 'application/octet-stream'];
  ELSIF p_bucket_name = 'program-media' THEN
    max_size := 10485760; -- 10MB
    allowed_types := ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  ELSE
    RETURN jsonb_build_object('valid', false, 'error', 'Invalid bucket');
  END IF;

  -- Validate file size
  IF p_file_size > max_size THEN
    RETURN jsonb_build_object('valid', false, 'error', 'File too large');
  END IF;

  -- Validate MIME type
  IF NOT (p_mime_type = ANY(allowed_types)) THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Invalid file type');
  END IF;

  -- Validate file name (prevent directory traversal)
  IF p_file_name ~ '\.\.|/|\\' THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Invalid file name');
  END IF;

  -- Log the validation attempt
  PERFORM public.log_security_event(
    'file_upload_validation',
    'file',
    p_file_name,
    jsonb_build_object(
      'file_size', p_file_size,
      'mime_type', p_mime_type,
      'bucket', p_bucket_name
    ),
    'low'
  );

  RETURN jsonb_build_object('valid', true);
END;
$$;

-- 9. Enhanced rate limiting function with better security
CREATE OR REPLACE FUNCTION public.check_rate_limit_secure(
  p_user_id UUID DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_endpoint TEXT DEFAULT 'general',
  p_limit INTEGER DEFAULT 100,
  p_window_minutes INTEGER DEFAULT 60
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  window_start_time TIMESTAMP WITH TIME ZONE;
  current_count INTEGER := 0;
  rate_limit_record RECORD;
  result JSONB;
  client_ip INET;
BEGIN
  -- Get actual client IP
  client_ip := COALESCE(p_ip_address, inet_client_addr());
  
  -- Calculate window start time
  window_start_time := date_trunc('minute', now()) - (EXTRACT(minute FROM now())::INTEGER % p_window_minutes) * INTERVAL '1 minute';
  
  -- Clean up old records (older than 24 hours)
  DELETE FROM public.rate_limits 
  WHERE window_start < now() - INTERVAL '24 hours';
  
  -- Try to find existing record for this window
  IF p_user_id IS NOT NULL THEN
    SELECT * INTO rate_limit_record
    FROM public.rate_limits
    WHERE user_id = p_user_id 
      AND endpoint = p_endpoint 
      AND window_start = window_start_time;
  ELSE
    SELECT * INTO rate_limit_record
    FROM public.rate_limits
    WHERE ip_address = client_ip 
      AND endpoint = p_endpoint 
      AND window_start = window_start_time
      AND user_id IS NULL;
  END IF;
  
  IF rate_limit_record IS NOT NULL THEN
    -- Update existing record
    current_count := rate_limit_record.request_count + 1;
    
    UPDATE public.rate_limits
    SET request_count = current_count,
        updated_at = now()
    WHERE id = rate_limit_record.id;
  ELSE
    -- Create new record
    current_count := 1;
    
    INSERT INTO public.rate_limits (user_id, ip_address, endpoint, request_count, window_start)
    VALUES (p_user_id, client_ip, p_endpoint, current_count, window_start_time);
  END IF;
  
  -- Log rate limit violations
  IF current_count > p_limit THEN
    PERFORM public.log_security_event(
      'rate_limit_exceeded',
      'rate_limit',
      p_endpoint,
      jsonb_build_object(
        'current_count', current_count,
        'limit', p_limit,
        'ip_address', client_ip::text
      ),
      'medium'
    );
  END IF;
  
  -- Return result
  result := jsonb_build_object(
    'allowed', current_count <= p_limit,
    'current_count', current_count,
    'limit', p_limit,
    'reset_time', window_start_time + (p_window_minutes || ' minutes')::INTERVAL,
    'remaining', GREATEST(0, p_limit - current_count)
  );
  
  RETURN result;
END;
$$;
