
-- Update rate limiting configurations to be more reasonable for actual usage
UPDATE public.rate_limit_configs 
SET 
  requests_per_hour = 50,
  requests_per_minute = 5,
  burst_limit = 10
WHERE endpoint = 'payment';

UPDATE public.rate_limit_configs 
SET 
  requests_per_hour = 100,
  requests_per_minute = 10,
  burst_limit = 20
WHERE endpoint = 'script-download';

-- Add a more generous rate limit for purchase confirmations
INSERT INTO public.rate_limit_configs (endpoint, requests_per_hour, requests_per_minute, burst_limit) 
VALUES ('purchase-confirmation', 20, 3, 8)
ON CONFLICT (endpoint) DO UPDATE SET
  requests_per_hour = EXCLUDED.requests_per_hour,
  requests_per_minute = EXCLUDED.requests_per_minute,
  burst_limit = EXCLUDED.burst_limit;

-- Update general rate limits to be more generous
UPDATE public.rate_limit_configs 
SET 
  requests_per_hour = 2000,
  requests_per_minute = 200,
  burst_limit = 500
WHERE endpoint = 'general';
