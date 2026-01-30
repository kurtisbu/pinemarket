
# Fix TradingView Script Sync Using Pine Facade API

## Problem Summary

The current implementation uses `https://www.tradingview.com/pine_perm/list_scripts/` which only returns Pine IDs without titles or URLs. The subsequent scraping methods (Access Manager, Search API, Profile page) are failing to map Pine IDs to their actual script information.

## Solution

Replace the entire discovery logic with TradingView's **Pine Facade API** endpoint discovered in your Python script:

```
https://pine-facade.tradingview.com/pine-facade/list?filter=published&limit=100
```

This endpoint returns complete script objects with `scriptName`, `scriptIdPart`, and `scriptAccess` - eliminating the need for multiple fallback scraping methods.

## What Changes

### 1. Update syncUserScripts.ts

**Replace** the complex multi-method approach with a single, reliable API call:

```text
BEFORE (Complex & Failing):
┌──────────────────────────────────────┐
│ 1. Fetch /pine_perm/list_scripts/    │ → Only gets Pine IDs
│ 2. Scrape /pine_perm/add/ page       │ → Unreliable HTML parsing  
│ 3. Search API with username          │ → May not find all scripts
│ 4. Profile page scraping             │ → JavaScript-loaded content
│ 5. Merge results with fallbacks      │ → Usually ends up with "Script [hash]"
└──────────────────────────────────────┘

AFTER (Simple & Reliable):
┌──────────────────────────────────────┐
│ 1. Fetch /pine-facade/list           │ → Gets FULL script data directly
│    - scriptName (actual title)       │
│    - scriptIdPart (pine_id)          │
│    - scriptAccess (public/invite)    │
│    - Additional metadata if present  │
└──────────────────────────────────────┘
```

### 2. New Primary Function: fetchScriptsFromPineFacade()

Create a new function that:
- Calls `pine-facade.tradingview.com/pine-facade/list?filter=published&limit=100`
- Uses the same cookie authentication
- Returns an array of script objects with title, pine_id, and access type
- This becomes the **primary and most reliable** data source

### 3. Keep Existing Methods as Fallbacks

The existing methods (Access Manager, Search API, Profile scraping) will become secondary fallbacks in case:
- The Pine Facade API changes or becomes unavailable
- Additional metadata (like publication URLs) needs to be fetched separately

### 4. Publication URL Discovery

The Pine Facade API returns `scriptName` and `scriptIdPart`, but likely **not** the `/script/{slug}/` URL directly. For publication URLs, we'll:
1. First, try to construct URLs using any `scriptSource` or `slug` field from the response
2. If not available, use the Search API to find the publication URL by script name
3. As a last resort, allow manual URL entry (already implemented)

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/tradingview-service/actions/syncUserScripts.ts` | Add `fetchScriptsFromPineFacade()` as primary method, restructure flow |

## Technical Details

### New API Endpoint

```javascript
const url = 'https://pine-facade.tradingview.com/pine-facade/list';
const params = new URLSearchParams({
  filter: 'published',
  limit: '100'
});

const response = await fetch(`${url}?${params}`, {
  method: 'GET',
  headers: {
    'Origin': 'https://www.tradingview.com',
    'Referer': 'https://www.tradingview.com/',
    'User-Agent': 'Mozilla/5.0...',
  },
  credentials: 'include',
  // Cookie: sessionid=...; sessionid_sign=...
});

// Response structure based on Python script:
// [
//   {
//     "scriptName": "Patreon - ADX Strategy - Capital Coders",
//     "scriptIdPart": "PUB;5db34fa27fdb4bbcbb8d656b67273f12",
//     "scriptAccess": "invite_only" | "open_no_auth",
//     // Possibly more fields like scriptSource, imageUrl, etc.
//   },
//   ...
// ]
```

### Script ID Format

The Python script shows `scriptIdPart` might include the `PUB;` prefix or not. We'll normalize:
```javascript
const pineId = item.scriptIdPart.startsWith('PUB;') 
  ? item.scriptIdPart 
  : `PUB;${item.scriptIdPart}`;
```

### Flow Diagram

```text
┌─────────────────────────────────────────────────────────────┐
│                     syncUserScripts()                        │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  PRIMARY: fetchScriptsFromPineFacade()                       │
│  GET pine-facade.tradingview.com/pine-facade/list           │
│  Returns: scriptName, scriptIdPart, scriptAccess            │
└─────────────────────────────────────────────────────────────┘
                            │
              ┌─────────────┴─────────────┐
              ▼                           ▼
         Success?                    Failure?
              │                           │
              ▼                           ▼
   ┌──────────────────────┐    ┌──────────────────────┐
   │ For each script:     │    │ FALLBACK: Use old    │
   │ - Got title ✓        │    │ methods (Access      │
   │ - Got pine_id ✓      │    │ Manager, Search API) │
   │ - Need URL?          │    └──────────────────────┘
   └──────────────────────┘
              │
              ▼
   ┌──────────────────────┐
   │ Try to get URL from: │
   │ 1. scriptSource field│
   │ 2. Search API lookup │
   │ 3. Manual entry later│
   └──────────────────────┘
              │
              ▼
   ┌──────────────────────┐
   │ Upsert to database   │
   └──────────────────────┘
```

## Testing Plan

1. Deploy updated edge function
2. Trigger a script sync from the seller dashboard
3. Check edge function logs for:
   - Successful Pine Facade API call
   - Correct script names extracted
   - Any publication URLs found
4. Verify in UI that scripts show correct titles
5. Test clicking on scripts to confirm URLs work (or use manual edit if needed)

## Expected Outcome

After this change:
- **Script titles** will be correct (e.g., "Patreon - ADX Strategy - Capital Coders")
- **Pine IDs** will be properly linked
- **Publication URLs** may still need the search API or manual entry, but titles will be accurate
