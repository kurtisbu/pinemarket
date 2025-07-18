
-- Add cookie health monitoring fields to profiles table
ALTER TABLE public.profiles 
ADD COLUMN tradingview_last_validated_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN tradingview_connection_status TEXT DEFAULT 'active' CHECK (tradingview_connection_status IN ('active', 'expired', 'error')),
ADD COLUMN tradingview_last_error TEXT;

-- Create index for efficient querying of connection status
CREATE INDEX idx_profiles_connection_status ON public.profiles(tradingview_connection_status);
CREATE INDEX idx_profiles_last_validated ON public.profiles(tradingview_last_validated_at);

-- Create notification preferences table for sellers
CREATE TABLE public.seller_notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  email_on_connection_expiry BOOLEAN DEFAULT true,
  email_on_program_disabled BOOLEAN DEFAULT true,
  last_expiry_notification_sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on seller_notifications
ALTER TABLE public.seller_notifications ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for seller_notifications
CREATE POLICY "Users can manage their own notification preferences" 
  ON public.seller_notifications 
  FOR ALL 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create a function to automatically disable programs when connection expires
CREATE OR REPLACE FUNCTION public.disable_programs_for_expired_connections()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update programs to draft status for sellers with expired connections
  UPDATE public.programs 
  SET status = 'draft',
      updated_at = now()
  WHERE seller_id IN (
    SELECT id FROM public.profiles 
    WHERE tradingview_connection_status = 'expired'
    AND is_tradingview_connected = true
  )
  AND status = 'published';
  
  -- Log the action
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
$$;

-- Create a function to check if seller has valid TradingView connection
CREATE OR REPLACE FUNCTION public.seller_has_valid_tradingview_connection(seller_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
$$;
