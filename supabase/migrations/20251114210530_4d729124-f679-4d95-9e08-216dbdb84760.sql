-- Disconnect the admin account from TradingView
UPDATE profiles 
SET 
  tradingview_username = NULL,
  is_tradingview_connected = false,
  tradingview_connection_status = NULL,
  tradingview_session_cookie = NULL,
  tradingview_signed_session_cookie = NULL,
  tradingview_last_validated_at = NULL,
  tradingview_last_error = NULL
WHERE id = 'f0cfedeb-ab66-457c-8431-96bee451ce52';

-- Delete the admin's synced scripts
DELETE FROM tradingview_scripts 
WHERE user_id = 'f0cfedeb-ab66-457c-8431-96bee451ce52';

-- Add unique constraint on tradingview_username
-- This ensures only one user can connect to each TradingView account
CREATE UNIQUE INDEX unique_tradingview_username 
ON profiles(tradingview_username) 
WHERE tradingview_username IS NOT NULL AND is_tradingview_connected = true;

-- Add comment explaining the constraint
COMMENT ON INDEX unique_tradingview_username IS 
'Ensures each TradingView account can only be connected to one user profile at a time';