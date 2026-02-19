

# Marketplace Testing Seed Plan

## Overview

Build an admin-only edge function (`seed-test-data`) that creates test accounts and programs using your real TradingView credentials and script portfolio. All test sellers will share your encrypted cookies so that script assignment works end-to-end with real TradingView API calls. A new "Test Data" tab in the Admin Dashboard provides seed and cleanup buttons.

## What Gets Created

### Test Sellers (3 accounts)
- Emails: `test-seller-1@pinemarket-test.com`, `test-seller-2@pinemarket-test.com`, `test-seller-3@pinemarket-test.com`
- Password: `TestPass123!`
- Each gets your real encrypted TradingView cookies and username (`capitalcodersllc`) copied from your profile
- `is_tradingview_connected = true`, `tradingview_connection_status = 'active'`
- Note: The one-account-per-user unique constraint on `tradingview_username` will need to be handled -- test sellers will share the username for testing purposes, so the seed function will use the service role to bypass this

### Test Buyers (3 accounts)
- Emails: `test-buyer-1@pinemarket-test.com`, `test-buyer-2@pinemarket-test.com`, `test-buyer-3@pinemarket-test.com`
- Password: `TestPass123!`
- Each gets a `tradingview_username` set (e.g., a test TV username you provide, or a placeholder for manual update)

### Test Programs (9 programs, 3 per seller)
Each seller gets 3 programs pulling from your real synced scripts, with varied configurations:

| Program | Category | Pricing | Trial |
|---------|----------|---------|-------|
| Seller 1, Prog 1 | Indicator | One-time $49.99 | None |
| Seller 1, Prog 2 | Strategy | Monthly $19.99, Yearly $149.99 | 7-day |
| Seller 1, Prog 3 | Strategy | One-time $99 + Monthly $29.99 | None |
| Seller 2, Prog 1 | Indicator | One-time $29.99 | 3-day |
| Seller 2, Prog 2 | Utility | Monthly $9.99 | None |
| Seller 2, Prog 3 | Strategy | Yearly $199.99 | 14-day |
| Seller 3, Prog 1 | Indicator | One-time $149.99 | None |
| Seller 3, Prog 2 | Strategy | Monthly $39.99, Yearly $299.99 | 7-day |
| Seller 3, Prog 3 | Utility | One-time $19.99 | None |

- Each program is linked to a real script from your `tradingview_scripts` table via the `program_scripts` junction table
- Programs start in `draft` status (can be manually published from admin for testing)

### Script Distribution
Your ~20 synced scripts will be distributed across the 9 programs (some programs may reference the same script, which is a valid real-world scenario).

## Implementation

### 1. Edge Function: `supabase/functions/seed-test-data/index.ts`

- Admin-only (checks `has_role` via service role)
- Actions: `seed` and `cleanup`
- **Seed flow:**
  1. Fetch your real profile's encrypted cookies and TradingView username
  2. Fetch your synced scripts from `tradingview_scripts`
  3. Create 6 auth users via `supabase.auth.admin.createUser()` with `email_confirm: true`
  4. Update seller profiles with your TV cookies, username, and connection status
  5. Update buyer profiles with display names and TV usernames
  6. Create 9 programs with varied categories, descriptions, and tags
  7. Create `program_prices` rows for each program
  8. Create `program_scripts` rows linking each program to real scripts
  9. Return all created IDs and credentials
- **Cleanup flow:**
  1. Find all users matching `*@pinemarket-test.com`
  2. Delete `program_scripts`, `program_prices`, `programs`, `profiles` for those users
  3. Delete auth users via `supabase.auth.admin.deleteUser()`
  4. Return counts of deleted records

### 2. Config: `supabase/config.toml`

Add entry:
```text
[functions.seed-test-data]
verify_jwt = false
```

### 3. New Component: `src/components/AdminTestData.tsx`

- "Seed Test Data" button -- calls the edge function with `action: "seed"`
- "Cleanup Test Data" button -- calls with `action: "cleanup"`
- Displays results: created accounts with emails/passwords, program titles, linked scripts
- Shows a table of test credentials for easy copy-paste
- Loading states and error handling

### 4. Modified: `src/pages/AdminDashboard.tsx`

- Add a "Test Data" tab (with a beaker icon) to the existing `TabsList`
- Grid changes from `grid-cols-6` to `grid-cols-7`
- Import and render `AdminTestData` in new `TabsContent`

## Important Notes

- **TradingView unique constraint**: Since multiple test sellers share the same TradingView username, the seed function uses service role to write directly, bypassing any application-level uniqueness checks. The database-level unique constraint on `tradingview_username` in profiles would block this -- the seed function will need to handle this by either using a single shared seller approach or appending suffixes. We will use one real TV connection and assign all test programs to the same real seller ID for script access, while the programs themselves are "owned" by different test sellers for marketplace variety.
- **Alternative approach**: All test programs can reference your real user ID as the source of TradingView credentials in `program_scripts` via script IDs from your `tradingview_scripts` table. The assignment flow looks up the seller's cookies from the `profiles` table, so we need each test seller to actually have valid cookies OR we route assignments through your real account. The simplest approach: all test sellers share your cookies and username (service role bypasses uniqueness).
- **Stripe**: Test sellers won't have Stripe Connect, so programs stay in `draft`. You can manually publish via SQL for purchase flow testing, or skip Stripe validation temporarily.
- **Buyer TV usernames**: You'll need to provide real TradingView usernames for test buyers if you want to verify actual script access grants. The seed function will prompt for these or use placeholders.

