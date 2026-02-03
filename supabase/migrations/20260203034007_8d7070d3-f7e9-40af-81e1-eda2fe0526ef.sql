-- Step 1: Remove the incorrect unique constraint on purchase_id
-- This allows multiple script assignments per purchase (for multi-script packages)
ALTER TABLE script_assignments 
DROP CONSTRAINT IF EXISTS script_assignments_purchase_id_key;

-- Step 2: Add composite unique constraint to prevent duplicate script assignments
-- This ensures the same script can't be assigned twice for the same purchase
ALTER TABLE script_assignments 
ADD CONSTRAINT script_assignments_purchase_script_unique 
UNIQUE (purchase_id, pine_id);