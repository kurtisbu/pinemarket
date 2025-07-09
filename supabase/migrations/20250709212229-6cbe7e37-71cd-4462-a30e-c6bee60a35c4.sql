
-- Create table for seller access codes
CREATE TABLE public.seller_access_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  is_used BOOLEAN NOT NULL DEFAULT false,
  used_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE,
  max_uses INTEGER DEFAULT 1,
  current_uses INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Enable RLS
ALTER TABLE public.seller_access_codes ENABLE ROW LEVEL SECURITY;

-- Admin can manage access codes
CREATE POLICY "Admins can manage seller access codes" 
ON public.seller_access_codes 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  )
);

-- Service role can validate codes during signup
CREATE POLICY "Service can validate access codes" 
ON public.seller_access_codes 
FOR SELECT 
USING (true);

-- Service can update code usage
CREATE POLICY "Service can update code usage" 
ON public.seller_access_codes 
FOR UPDATE 
USING (true);

-- Create function to validate and use access code
CREATE OR REPLACE FUNCTION public.validate_seller_access_code(
  p_code TEXT,
  p_user_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  code_record RECORD;
  result JSONB;
BEGIN
  -- Find the access code
  SELECT * INTO code_record
  FROM public.seller_access_codes
  WHERE code = p_code;
  
  -- Check if code exists
  IF code_record IS NULL THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'Invalid access code'
    );
  END IF;
  
  -- Check if code has expired
  IF code_record.expires_at IS NOT NULL AND code_record.expires_at < now() THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'Access code has expired'
    );
  END IF;
  
  -- Check if code has reached max uses
  IF code_record.current_uses >= code_record.max_uses THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'Access code has been fully used'
    );
  END IF;
  
  -- Check if this user has already used this code
  IF code_record.used_by_user_id = p_user_id THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'You have already used this access code'
    );
  END IF;
  
  -- Mark code as used
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
$$;
