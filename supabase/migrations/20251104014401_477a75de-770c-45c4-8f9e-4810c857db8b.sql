-- Fix security: Add search_path to verify_seller_bank_account function
CREATE OR REPLACE FUNCTION verify_seller_bank_account(p_user_id UUID)
RETURNS void
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Check if caller is admin
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  
  -- Verify the bank account
  UPDATE seller_payout_info
  SET 
    is_verified = true,
    updated_at = now()
  WHERE user_id = p_user_id;
  
  -- Log the verification
  PERFORM log_security_event(
    'bank_account_verified',
    'payout_info',
    p_user_id::text,
    jsonb_build_object('verified_by', auth.uid()),
    'low'
  );
END;
$$ LANGUAGE plpgsql;