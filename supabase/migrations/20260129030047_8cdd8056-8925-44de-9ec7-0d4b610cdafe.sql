-- Fix SECURITY DEFINER functions missing search_path
-- This prevents search path injection attacks

-- Fix increment_program_view_count
CREATE OR REPLACE FUNCTION public.increment_program_view_count(program_uuid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  UPDATE public.programs 
  SET view_count = view_count + 1 
  WHERE id = program_uuid;
END;
$function$;

-- Fix get_script_download_url
CREATE OR REPLACE FUNCTION public.get_script_download_url(program_id_param uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  script_path TEXT;
  has_access BOOLEAN := FALSE;
BEGIN
  SELECT script_file_path INTO script_path
  FROM public.programs
  WHERE id = program_id_param;
  
  IF script_path IS NULL THEN
    RETURN NULL;
  END IF;
  
  SELECT EXISTS(
    SELECT 1 FROM public.programs p
    WHERE p.id = program_id_param
    AND p.seller_id = auth.uid()
  ) OR EXISTS(
    SELECT 1 FROM public.purchases pu
    WHERE pu.program_id = program_id_param
    AND pu.buyer_id = auth.uid()
    AND pu.status = 'completed'
  ) INTO has_access;
  
  IF NOT has_access THEN
    RAISE EXCEPTION 'Access denied: You must purchase this program to download the script';
  END IF;
  
  RETURN script_path;
END;
$function$;

-- Fix validate_seller_access_code
CREATE OR REPLACE FUNCTION public.validate_seller_access_code(p_code text, p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  code_record RECORD;
  result JSONB;
BEGIN
  SELECT * INTO code_record
  FROM public.seller_access_codes
  WHERE code = p_code;
  
  IF code_record IS NULL THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'Invalid access code'
    );
  END IF;
  
  IF code_record.expires_at IS NOT NULL AND code_record.expires_at < now() THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'Access code has expired'
    );
  END IF;
  
  IF code_record.current_uses >= code_record.max_uses THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'Access code has been fully used'
    );
  END IF;
  
  IF code_record.used_by_user_id = p_user_id THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'You have already used this access code'
    );
  END IF;
  
  UPDATE public.seller_access_codes
  SET 
    current_uses = current_uses + 1,
    is_used = CASE 
      WHEN current_uses + 1 >= max_uses THEN true 
      ELSE false 
    END,
    used_by_user_id = CASE 
      WHEN current_uses = 0 THEN p_user_id 
      ELSE used_by_user_id 
    END,
    used_at = CASE 
      WHEN current_uses = 0 THEN now() 
      ELSE used_at 
    END
  WHERE id = code_record.id;
  
  RETURN jsonb_build_object(
    'valid', true,
    'message', 'Access code validated successfully'
  );
END;
$function$;

-- Fix disable_programs_for_expired_connections
CREATE OR REPLACE FUNCTION public.disable_programs_for_expired_connections()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  UPDATE public.programs 
  SET status = 'draft',
      updated_at = now()
  WHERE seller_id IN (
    SELECT id FROM public.profiles 
    WHERE tradingview_connection_status = 'expired'
    AND is_tradingview_connected = true
  )
  AND status = 'published';
  
  INSERT INTO public.security_audit_logs (
    action,
    resource_type,
    details,
    risk_level
  ) VALUES (
    'auto_disable_programs_expired_connection',
    'program',
    jsonb_build_object(
      'affected_programs', (
        SELECT COUNT(*) FROM public.programs 
        WHERE seller_id IN (
          SELECT id FROM public.profiles 
          WHERE tradingview_connection_status = 'expired'
          AND is_tradingview_connected = true
        )
        AND status = 'draft'
      )
    ),
    'medium'
  );
END;
$function$;

-- Fix check_rate_limit
CREATE OR REPLACE FUNCTION public.check_rate_limit(p_user_id uuid DEFAULT NULL::uuid, p_ip_address inet DEFAULT NULL::inet, p_endpoint text DEFAULT 'general'::text, p_limit integer DEFAULT 100, p_window_minutes integer DEFAULT 60)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  window_start_time TIMESTAMP WITH TIME ZONE;
  current_count INTEGER := 0;
  rate_limit_record RECORD;
  result JSONB;
BEGIN
  window_start_time := date_trunc('minute', now()) - (EXTRACT(minute FROM now())::INTEGER % p_window_minutes) * INTERVAL '1 minute';
  
  DELETE FROM public.rate_limits 
  WHERE window_start < now() - INTERVAL '24 hours';
  
  IF p_user_id IS NOT NULL THEN
    SELECT * INTO rate_limit_record
    FROM public.rate_limits
    WHERE user_id = p_user_id 
      AND endpoint = p_endpoint 
      AND window_start = window_start_time;
  ELSE
    SELECT * INTO rate_limit_record
    FROM public.rate_limits
    WHERE ip_address = p_ip_address 
      AND endpoint = p_endpoint 
      AND window_start = window_start_time
      AND user_id IS NULL;
  END IF;
  
  IF rate_limit_record IS NOT NULL THEN
    current_count := rate_limit_record.request_count + 1;
    
    UPDATE public.rate_limits
    SET request_count = current_count,
        updated_at = now()
    WHERE id = rate_limit_record.id;
  ELSE
    current_count := 1;
    
    INSERT INTO public.rate_limits (user_id, ip_address, endpoint, request_count, window_start)
    VALUES (p_user_id, p_ip_address, p_endpoint, current_count, window_start_time);
  END IF;
  
  result := jsonb_build_object(
    'allowed', current_count <= p_limit,
    'current_count', current_count,
    'limit', p_limit,
    'reset_time', window_start_time + (p_window_minutes || ' minutes')::INTERVAL,
    'remaining', GREATEST(0, p_limit - current_count)
  );
  
  RETURN result;
END;
$function$;

-- Fix update_program_rating_stats
CREATE OR REPLACE FUNCTION public.update_program_rating_stats(program_uuid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  UPDATE public.programs 
  SET 
    average_rating = COALESCE((
      SELECT AVG(rating::numeric) 
      FROM public.ratings 
      WHERE program_id = program_uuid
    ), 0),
    rating_count = COALESCE((
      SELECT COUNT(*) 
      FROM public.ratings 
      WHERE program_id = program_uuid
    ), 0)
  WHERE id = program_uuid;
END;
$function$;

-- Fix seller_has_valid_tradingview_connection
CREATE OR REPLACE FUNCTION public.seller_has_valid_tradingview_connection(seller_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  connection_valid BOOLEAN := false;
BEGIN
  SELECT 
    is_tradingview_connected = true 
    AND tradingview_connection_status = 'active'
    AND (tradingview_last_validated_at IS NULL OR tradingview_last_validated_at > now() - INTERVAL '24 hours')
  INTO connection_valid
  FROM public.profiles
  WHERE id = seller_user_id;
  
  RETURN COALESCE(connection_valid, false);
END;
$function$;

-- Fix log_security_event
CREATE OR REPLACE FUNCTION public.log_security_event(p_action text, p_resource_type text, p_resource_id text DEFAULT NULL::text, p_details jsonb DEFAULT NULL::jsonb, p_risk_level text DEFAULT 'low'::text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
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
$function$;

-- Fix validate_file_upload
CREATE OR REPLACE FUNCTION public.validate_file_upload(p_file_name text, p_file_size bigint, p_mime_type text, p_bucket_name text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  validation_result JSONB;
  max_size BIGINT;
  allowed_types TEXT[];
BEGIN
  IF p_bucket_name = 'pine-scripts' THEN
    max_size := 10485760;
    allowed_types := ARRAY['text/plain', 'application/octet-stream'];
  ELSIF p_bucket_name = 'program-media' THEN
    max_size := 10485760;
    allowed_types := ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  ELSE
    RETURN jsonb_build_object('valid', false, 'error', 'Invalid bucket');
  END IF;

  IF p_file_size > max_size THEN
    RETURN jsonb_build_object('valid', false, 'error', 'File too large');
  END IF;

  IF NOT (p_mime_type = ANY(allowed_types)) THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Invalid file type');
  END IF;

  IF p_file_name ~ '\.\.|/|\\' THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Invalid file name');
  END IF;

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
$function$;

-- Fix check_rate_limit_secure
CREATE OR REPLACE FUNCTION public.check_rate_limit_secure(p_user_id uuid DEFAULT NULL::uuid, p_ip_address inet DEFAULT NULL::inet, p_endpoint text DEFAULT 'general'::text, p_limit integer DEFAULT 100, p_window_minutes integer DEFAULT 60)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  window_start_time TIMESTAMP WITH TIME ZONE;
  current_count INTEGER := 0;
  rate_limit_record RECORD;
  result JSONB;
  client_ip INET;
BEGIN
  client_ip := COALESCE(p_ip_address, inet_client_addr());
  
  window_start_time := date_trunc('minute', now()) - (EXTRACT(minute FROM now())::INTEGER % p_window_minutes) * INTERVAL '1 minute';
  
  DELETE FROM public.rate_limits 
  WHERE window_start < now() - INTERVAL '24 hours';
  
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
    current_count := rate_limit_record.request_count + 1;
    
    UPDATE public.rate_limits
    SET request_count = current_count,
        updated_at = now()
    WHERE id = rate_limit_record.id;
  ELSE
    current_count := 1;
    
    INSERT INTO public.rate_limits (user_id, ip_address, endpoint, request_count, window_start)
    VALUES (p_user_id, client_ip, p_endpoint, current_count, window_start_time);
  END IF;
  
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
  
  result := jsonb_build_object(
    'allowed', current_count <= p_limit,
    'current_count', current_count,
    'limit', p_limit,
    'reset_time', window_start_time + (p_window_minutes || ' minutes')::INTERVAL,
    'remaining', GREATEST(0, p_limit - current_count)
  );
  
  RETURN result;
END;
$function$;

-- Fix check_trial_eligibility
CREATE OR REPLACE FUNCTION public.check_trial_eligibility(p_user_id uuid, p_program_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  RETURN NOT EXISTS (
    SELECT 1 FROM public.trial_usage 
    WHERE user_id = p_user_id AND program_id = p_program_id
  );
END;
$function$;

-- Fix record_trial_usage
CREATE OR REPLACE FUNCTION public.record_trial_usage(p_user_id uuid, p_program_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.trial_usage (user_id, program_id)
  VALUES (p_user_id, p_program_id)
  ON CONFLICT (user_id, program_id) DO NOTHING;
END;
$function$;

-- Fix validate_tradingview_url
CREATE OR REPLACE FUNCTION public.validate_tradingview_url(url text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF url IS NULL OR url = '' THEN
    RETURN FALSE;
  END IF;
  
  IF url ~* '^https://www\.tradingview\.com/(script|chart)/' THEN
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$function$;

-- Fix sanitize_user_content
CREATE OR REPLACE FUNCTION public.sanitize_user_content(content text, max_length integer DEFAULT 1000)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF content IS NULL THEN
    RETURN NULL;
  END IF;
  
  content := regexp_replace(content, '<[^>]*>', '', 'g');
  content := regexp_replace(content, 'javascript:', '', 'gi');
  content := regexp_replace(content, 'data:', '', 'gi');
  content := left(content, max_length);
  
  RETURN trim(content);
END;
$function$;

-- Fix validate_program_data
CREATE OR REPLACE FUNCTION public.validate_program_data()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  NEW.title := public.sanitize_user_content(NEW.title, 200);
  
  NEW.description := public.sanitize_user_content(NEW.description, 5000);
  
  IF NEW.tradingview_publication_url IS NOT NULL 
     AND NOT public.validate_tradingview_url(NEW.tradingview_publication_url) THEN
    RAISE EXCEPTION 'Invalid TradingView publication URL format';
  END IF;
  
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
$function$;

-- Fix update_seller_balance
CREATE OR REPLACE FUNCTION public.update_seller_balance(p_seller_id uuid, p_amount numeric, p_type text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.seller_balances (seller_id, available_balance, pending_balance, total_earned)
  VALUES (p_seller_id, 0, 0, 0)
  ON CONFLICT (seller_id) DO NOTHING;

  IF p_type = 'sale' THEN
    UPDATE public.seller_balances
    SET 
      pending_balance = pending_balance + p_amount,
      total_earned = total_earned + p_amount,
      updated_at = now()
    WHERE seller_id = p_seller_id;
  ELSIF p_type = 'payout' THEN
    UPDATE public.seller_balances
    SET 
      available_balance = available_balance - p_amount,
      total_paid_out = total_paid_out + p_amount,
      last_payout_at = now(),
      updated_at = now()
    WHERE seller_id = p_seller_id;
  END IF;
END;
$function$;

-- Fix settle_pending_balance
CREATE OR REPLACE FUNCTION public.settle_pending_balance(p_seller_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  UPDATE public.seller_balances
  SET 
    available_balance = available_balance + pending_balance,
    pending_balance = 0,
    updated_at = now()
  WHERE seller_id = p_seller_id;
END;
$function$;