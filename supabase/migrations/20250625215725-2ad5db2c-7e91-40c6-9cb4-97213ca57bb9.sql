
-- Create rate_limits table to track API usage
CREATE TABLE public.rate_limits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  ip_address INET,
  endpoint TEXT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add indexes for efficient lookups
CREATE INDEX idx_rate_limits_user_endpoint ON public.rate_limits(user_id, endpoint);
CREATE INDEX idx_rate_limits_ip_endpoint ON public.rate_limits(ip_address, endpoint);
CREATE INDEX idx_rate_limits_window_start ON public.rate_limits(window_start);

-- Enable RLS
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Create policies for rate limits (admin only for security)
CREATE POLICY "Service role can manage rate limits" 
  ON public.rate_limits 
  FOR ALL 
  USING (auth.role() = 'service_role');

-- Create function to check and update rate limits
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_user_id UUID DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_endpoint TEXT DEFAULT 'general',
  p_limit INTEGER DEFAULT 100,
  p_window_minutes INTEGER DEFAULT 60
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  window_start_time TIMESTAMP WITH TIME ZONE;
  current_count INTEGER := 0;
  rate_limit_record RECORD;
  result JSONB;
BEGIN
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
    WHERE ip_address = p_ip_address 
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
    VALUES (p_user_id, p_ip_address, p_endpoint, current_count, window_start_time);
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

-- Create rate limit configurations table
CREATE TABLE public.rate_limit_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  endpoint TEXT NOT NULL UNIQUE,
  requests_per_hour INTEGER NOT NULL DEFAULT 100,
  requests_per_minute INTEGER NOT NULL DEFAULT 10,
  burst_limit INTEGER NOT NULL DEFAULT 20,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert default rate limit configurations
INSERT INTO public.rate_limit_configs (endpoint, requests_per_hour, requests_per_minute, burst_limit) VALUES
  ('payment', 10, 2, 5),
  ('purchase', 20, 3, 10),
  ('script-download', 50, 5, 15),
  ('auth', 30, 5, 10),
  ('general', 1000, 100, 200);

-- Enable RLS for rate limit configs
ALTER TABLE public.rate_limit_configs ENABLE ROW LEVEL SECURITY;

-- Allow public read access to rate limit configs
CREATE POLICY "Anyone can view rate limit configs" 
  ON public.rate_limit_configs 
  FOR SELECT 
  USING (true);

-- Add trigger for updated_at
CREATE TRIGGER set_rate_limits_updated_at
  BEFORE UPDATE ON public.rate_limits
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_rate_limit_configs_updated_at
  BEFORE UPDATE ON public.rate_limit_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
