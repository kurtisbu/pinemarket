
# Fix: Allow Multiple Script Assignments Per Purchase

## Problem Summary

The recent test purchase for a 2-script package only created **1 script assignment** instead of 2. 

### Root Cause
The `script_assignments` table has a **unique constraint on `purchase_id`**:
```sql
UNIQUE (purchase_id)
```

This constraint prevents multiple scripts from being assigned to a single purchase. When the webhook tries to insert the second script assignment with the same `purchase_id`, the database rejects it due to the unique constraint violation.

### Evidence
- Webhook logged: "Creating 2 script assignments for program"
- Only 1 assignment record exists in the database for the purchase
- Database constraint query shows: `UNIQUE (purchase_id)` on `script_assignments`

## Solution

### Step 1: Remove the Incorrect Unique Constraint

Run a database migration to drop the unique constraint on `purchase_id`:

```sql
ALTER TABLE script_assignments 
DROP CONSTRAINT script_assignments_purchase_id_key;
```

This is the core fix. A single purchase of a multi-script package/program should create multiple assignment records - one per script.

### Step 2: Add Proper Composite Unique Constraint (Optional)

To prevent duplicate assignments of the same script to the same purchase, add a composite unique constraint:

```sql
ALTER TABLE script_assignments 
ADD CONSTRAINT script_assignments_purchase_script_unique 
UNIQUE (purchase_id, pine_id);
```

This ensures:
- Multiple scripts per purchase are allowed
- The same script cannot be assigned twice for the same purchase

## Additional Finding: TradingView Access Verification

The verification endpoint is returning 400 errors. This is a separate issue that doesn't prevent access from being granted, but it does mean we can't confirm access was granted. The assignment is still marked as "assigned" because TradingView returned `{ status: "exists" }` (user already has access) or `{ status: "ok" }` (access granted).

### Verification Fix (Secondary Priority)

The `list_users` endpoint may require different formatting. Current implementation sends:
```
POST https://www.tradingview.com/pine_perm/list_users/
Content-Type: application/x-www-form-urlencoded
Body: pine_id=PUB;xxx&username=test
```

This may need to be changed to `multipart/form-data` format like the add endpoint uses.

## Testing Plan

After applying the database migration:
1. Complete another test purchase for the 2-script package
2. Verify both script assignments are created in the database
3. Confirm both scripts show "assigned" status
4. Check TradingView Access Manager to verify the buyer has access to both scripts
