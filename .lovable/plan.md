
# Bundle Multiple Scripts into a Program

## Summary

Change the program creation flow to allow sellers to select multiple TradingView scripts when creating a sellable product. This transforms a "program" from being tied to a single script into a flexible bundle that can contain one or more scripts.

## Current vs. Proposed Flow

```text
CURRENT FLOW:
+------------------+      +------------------+      +------------------+
| Create Program   | ---> | Link ONE Script  | ---> | Set Pricing      |
| (single script)  |      | (URL or file)    |      |                  |
+------------------+      +------------------+      +------------------+

                    OR

+------------------+      +------------------+      +------------------+
| Create Package   | ---> | Select MULTIPLE  | ---> | Set Pricing      |
| (bundle)         |      | published progs  |      |                  |
+------------------+      +------------------+      +------------------+


PROPOSED FLOW:
+------------------+      +------------------+      +------------------+
| Create Program   | ---> | Select MULTIPLE  | ---> | Set Pricing      |
| (1+ scripts)     |      | synced scripts   |      |                  |
+------------------+      +------------------+      +------------------+
```

## Database Changes

### New Junction Table: `program_scripts`

Create a new table to link programs to multiple TradingView scripts:

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| program_id | uuid | FK to programs |
| tradingview_script_id | uuid | FK to tradingview_scripts |
| display_order | integer | Order in which scripts appear |
| created_at | timestamp | When added |

This table will store the many-to-many relationship between programs and scripts.

### Migration for Existing Data

Existing programs with `tradingview_script_id` will be migrated:
- For each program with a `tradingview_script_id`, create a corresponding entry in `program_scripts`
- The old `tradingview_script_id` column on `programs` can remain for backward compatibility

## Frontend Changes

### 1. New Component: `ScriptSelector.tsx`

A reusable component that:
- Displays the seller's synced TradingView scripts from `tradingview_scripts` table
- Allows multi-select with checkboxes
- Shows script thumbnails, titles, and pine IDs
- Supports drag-and-drop reordering
- Shows a warning if no scripts are synced (with link to sync)

### 2. Update `SellScriptForm.tsx`

Replace the current `ScriptUploadSection` with the new `ScriptSelector`:

```text
BEFORE:
- Radio: "TradingView link" or "Upload file"
- Single URL input or file upload

AFTER:
- Section header: "Select Scripts to Include"
- Grid/list of synced TradingView scripts with checkboxes
- Minimum 1 script required
- "Sync with TradingView" button if no scripts available
```

### 3. Update `useSellScriptForm.ts` Hook

- Add `selectedScripts` state (array of script IDs)
- Remove single `tradingview_publication_url` handling
- Update form validation to require at least 1 script
- Update submit handler to:
  1. Create the program
  2. Insert entries into `program_scripts` junction table

### 4. Update `ProgramBasicForm.tsx`

Remove any single-script related fields if present.

### 5. Update `EditProgram.tsx`

- Show currently linked scripts
- Allow adding/removing scripts
- Update the `program_scripts` junction table on save

## Backend Changes

### 1. Update Edge Function: `stripe-webhook/index.ts`

When processing a purchase:
- Fetch all scripts linked to the program via `program_scripts`
- Create a `script_assignment` for EACH linked script

```javascript
// Fetch scripts for the program
const { data: programScripts } = await supabaseAdmin
  .from('program_scripts')
  .select('tradingview_script_id, tradingview_scripts(pine_id)')
  .eq('program_id', programId);

// Create assignment for each script
for (const ps of programScripts) {
  await supabaseAdmin.from('script_assignments').insert({
    // ... assignment data with ps.tradingview_scripts.pine_id
  });
}
```

### 2. Update `create-program-prices` Edge Function

No changes needed - pricing is already program-level.

### 3. Update Program Detail Display

When viewing a program, show all included scripts (for buyers to see what they're getting).

## UI/UX Details

### Script Selector Component

```text
+----------------------------------------------------------+
| Select Scripts to Include *                              |
| Choose one or more scripts from your TradingView account |
+----------------------------------------------------------+
| [Sync with TradingView]                                  |
+----------------------------------------------------------+
| +-------+  +-------+  +-------+                          |
| |[thumb]|  |[thumb]|  |[thumb]|                          |
| | ADX   |  | MACD  |  | RSI   |                          |
| | Strat |  | Cross |  | Div   |                          |
| |  [x]  |  |  [ ]  |  |  [x]  |                          |
| +-------+  +-------+  +-------+                          |
+----------------------------------------------------------+
| Selected: 2 scripts                                      |
+----------------------------------------------------------+
```

### Program Detail Page (Buyer View)

```text
+----------------------------------------------------------+
| Complete Trading Suite              $49/month            |
+----------------------------------------------------------+
| This package includes:                                   |
| - ADX Strategy (Pine Script)                            |
| - RSI Divergence Indicator                              |
|                                                          |
| [Subscribe Now]                                          |
+----------------------------------------------------------+
```

## Files to Create

| File | Purpose |
|------|---------|
| `src/components/SellScript/ScriptSelector.tsx` | Multi-select script picker component |

## Files to Modify

| File | Changes |
|------|---------|
| `src/hooks/useSellScriptForm.ts` | Add selectedScripts state, update submit logic |
| `src/components/SellScript/SellScriptForm.tsx` | Replace ScriptUploadSection with ScriptSelector |
| `src/pages/EditProgram.tsx` | Add script selection/editing |
| `src/components/ProgramDetail/ProgramDescription.tsx` | Show included scripts |
| `supabase/functions/stripe-webhook/index.ts` | Handle multi-script assignments |

## Database Migration

```sql
-- Create junction table for program-script relationships
CREATE TABLE program_scripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  tradingview_script_id UUID NOT NULL REFERENCES tradingview_scripts(id) ON DELETE CASCADE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(program_id, tradingview_script_id)
);

-- Enable RLS
ALTER TABLE program_scripts ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Sellers can manage their program scripts"
  ON program_scripts FOR ALL
  USING (EXISTS (
    SELECT 1 FROM programs 
    WHERE programs.id = program_scripts.program_id 
    AND programs.seller_id = auth.uid()
  ));

CREATE POLICY "Everyone can view scripts for published programs"
  ON program_scripts FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM programs 
    WHERE programs.id = program_scripts.program_id 
    AND programs.status = 'published'
  ));

-- Migrate existing programs with tradingview_script_id
INSERT INTO program_scripts (program_id, tradingview_script_id, display_order)
SELECT 
  p.id,
  ts.id,
  0
FROM programs p
JOIN tradingview_scripts ts ON ts.pine_id = p.tradingview_script_id
WHERE p.tradingview_script_id IS NOT NULL;
```

## Testing Plan

1. Create a new program with 1 script - verify it works like before
2. Create a program with 3 scripts - verify all are stored
3. Edit a program to add/remove scripts
4. Purchase a multi-script program - verify all scripts get assigned
5. View program detail page - verify all scripts are displayed to buyers
