
-- First, drop the existing foreign key constraint
ALTER TABLE public.rate_limits 
DROP CONSTRAINT IF EXISTS rate_limits_user_id_fkey;

-- Recreate the foreign key constraint with CASCADE delete
ALTER TABLE public.rate_limits 
ADD CONSTRAINT rate_limits_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) 
ON DELETE CASCADE;
