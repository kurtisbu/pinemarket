
# Fix TradingView Script Names and Publication URLs

## Problem Summary

When syncing TradingView scripts, the system correctly fetches **Pine IDs** (e.g., `PUB;5db34fa27fdb4bbcbb8d656b67273f12`) but fails to get the correct:
- **Script titles** (shows "Script [hash]" instead of "Patreon - ADX Strategy - Capital Coders")
- **Publication URLs** (shows profile fallback instead of `https://www.tradingview.com/script/2aWqDm4d-...`)

The core issue is that TradingView's URL slug (`2aWqDm4d`) is **completely independent** from the Pine ID - there's no algorithmic way to derive one from the other.

## Root Cause Analysis

1. The current code tries to scrape `/u/{username}/scripts/` but this endpoint returns **404**
2. The user profile page loads scripts via JavaScript, so static HTML scraping doesn't work
3. TradingView doesn't expose a public API to map Pine IDs to publication URLs

## Solution: Scrape Script Info Directly from `/pine_perm/add/` Page

TradingView's **Access Manager** page (`/pine_perm/add/`) shows a dropdown of your scripts with both the title and internal IDs when you're logged in. We can:

1. Fetch the Access Manager page using the session cookies
2. Parse the script dropdown options which contain Pine IDs and script names
3. For each script found, fetch the script's individual page to extract the publication URL

Alternatively, we can use the **HTML of the user's public profile** with an internal API that TradingView uses to load scripts data dynamically.

## Implementation Plan

### Step 1: Update Script Discovery Logic

Modify `syncUserScripts.ts` to:

```text
+------------------------------------------+
| 1. Fetch /pine_perm/list_scripts/        |
|    (Gets all Pine IDs - WORKS)           |
+------------------------------------------+
              |
              v
+------------------------------------------+
| 2. Fetch /pine_perm/add/ page            |
|    (Access Manager with script dropdown) |
+------------------------------------------+
              |
              v
+------------------------------------------+
| 3. Parse HTML for <option> or JSON data  |
|    containing pine_id -> title mapping   |
+------------------------------------------+
              |
              v
+------------------------------------------+
| 4. For each pine_id without URL:         |
|    - Use TradingView search API          |
|    - OR scrape user's public scripts     |
|    - OR store title-only for now         |
+------------------------------------------+
```

### Step 2: Try Multiple Discovery Methods

The updated code will try these methods in order:

1. **Method A**: Parse `/pine_perm/add/` page for script dropdowns containing `pine_id` and titles
2. **Method B**: Use TradingView's internal scripts search API: `https://www.tradingview.com/pubscripts-suggest-json/?search={username}`
3. **Method C**: Scrape the user's profile tab content using the hash fragment anchor approach
4. **Method D**: Store scripts with titles only (fallback), allowing manual URL updates

### Step 3: Add "Edit Script URL" Feature for Sellers

Since automated discovery may not always work, add a UI feature allowing sellers to manually update publication URLs for their synced scripts.

## Technical Details

### New API Endpoint to Try

```javascript
// TradingView's internal scripts search API
const searchUrl = `https://www.tradingview.com/pubscripts-suggest-json/?search=${encodeURIComponent(scriptTitle)}`;
```

### Access Manager Page Parsing

```javascript
// The /pine_perm/add/ page contains a script selector with pine_id values
// Parse patterns like:
// <option value="PUB;abc123">Script Title</option>
// or JSON data embedded in the page
```

### Manual URL Update (Database)

```sql
-- Allow sellers to update publication_url manually
UPDATE tradingview_scripts 
SET publication_url = 'https://www.tradingview.com/script/2aWqDm4d-...'
WHERE pine_id = 'PUB;5db34fa27fdb4bbcbb8d656b67273f12' 
AND user_id = :seller_id;
```

## Files to Modify

1. **`supabase/functions/tradingview-service/actions/syncUserScripts.ts`**
   - Replace failing scraping logic with Access Manager page parsing
   - Add TradingView search API fallback
   - Add better error logging for debugging

2. **`src/components/SellerTradingViewIntegration.tsx`** (new feature)
   - Add "Edit" button next to each script
   - Allow manual publication URL input
   - Validate URL format

3. **Database** (if needed)
   - Ensure `publication_url` allows NULL or has a valid fallback

## Testing Plan

1. Re-sync scripts after deploying the updated edge function
2. Check edge function logs for successful title/URL extraction
3. Verify clicking on scripts goes to the correct TradingView page
4. Test manual URL editing as a fallback

## Timeline

- Step 1 (Edge function update): Primary fix
- Step 2 (Manual editing UI): Fallback option if automated discovery still fails
