

# Fix Trial Script Assignment Flow

## Problem

The trial creation code in `stripe-connect/index.ts` has two bugs:

1. **Uses wrong field for script lookup** -- It reads `program.tradingview_script_id` (a legacy column that's `null` for your program). The actual scripts are linked via the `program_scripts` junction table.
2. **Only creates one assignment** -- Programs can have multiple scripts (yours has 5), but the trial flow only creates a single `script_assignments` row.

The paid purchase flow in `stripe-webhook/index.ts` already handles both correctly by querying `program_scripts` and looping. The trial flow needs the same pattern.

## Fix

### `supabase/functions/stripe-connect/index.ts` -- `createTrialAccess` function

Replace the current single-assignment logic with the same multi-script pattern used by the webhook:

1. After creating the trial purchase record, query `program_scripts` joined with `tradingview_scripts` to get all linked scripts and their `pine_id` values
2. Loop through each script, creating a separate `script_assignments` row for each
3. For each assignment, trigger `tradingview-service` `assign-script-access` individually
4. Track success/failure per script and return aggregated results
5. Keep the legacy `program.tradingview_script_id` fallback for programs not using the junction table

The current code that creates one assignment + one TV call (~lines 147-230) will be replaced with a loop mirroring the webhook's `createProgramScriptAssignments` pattern.

### No other files need changes

The `assignScriptAccess` function in `tradingview-service` already works correctly when given a valid `pine_id` -- the only issue was receiving `null`.

