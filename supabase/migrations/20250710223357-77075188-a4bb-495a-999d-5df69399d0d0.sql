
-- Fix script_assignments table foreign key constraints to cascade delete
ALTER TABLE public.script_assignments 
DROP CONSTRAINT IF EXISTS script_assignments_buyer_id_fkey;

ALTER TABLE public.script_assignments 
ADD CONSTRAINT script_assignments_buyer_id_fkey 
FOREIGN KEY (buyer_id) REFERENCES public.profiles(id) 
ON DELETE CASCADE;

ALTER TABLE public.script_assignments 
DROP CONSTRAINT IF EXISTS script_assignments_seller_id_fkey;

ALTER TABLE public.script_assignments 
ADD CONSTRAINT script_assignments_seller_id_fkey 
FOREIGN KEY (seller_id) REFERENCES public.profiles(id) 
ON DELETE CASCADE;

-- Fix security_audit_logs to set user_id to NULL when user is deleted (preserve audit trail)
ALTER TABLE public.security_audit_logs 
DROP CONSTRAINT IF EXISTS security_audit_logs_user_id_fkey;

ALTER TABLE public.security_audit_logs 
ADD CONSTRAINT security_audit_logs_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) 
ON DELETE SET NULL;

-- Fix trial_usage to cascade delete when user is deleted
ALTER TABLE public.trial_usage 
DROP CONSTRAINT IF EXISTS trial_usage_user_id_fkey;

ALTER TABLE public.trial_usage 
ADD CONSTRAINT trial_usage_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) 
ON DELETE CASCADE;

-- Fix tradingview_scripts to cascade delete when user is deleted
ALTER TABLE public.tradingview_scripts 
DROP CONSTRAINT IF EXISTS tradingview_scripts_user_id_fkey;

ALTER TABLE public.tradingview_scripts 
ADD CONSTRAINT tradingview_scripts_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) 
ON DELETE CASCADE;
