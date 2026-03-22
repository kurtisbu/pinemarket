

# Refresh Cookies Button + Proactive Expiry Warnings

## Overview

Two features to improve the seller cookie lifecycle:

1. **"Update Cookies" button** on the seller dashboard settings -- a streamlined flow to paste new cookies, test, and re-activate without full onboarding
2. **Proactive expiry warnings** in the health check -- track cookie age and warn sellers before cookies expire and programs get disabled

Additionally, address the TradingView rate limiting concern in the health check.

---

## Rate Limiting Concern

You're right to be concerned. The current health check makes one HTTP request per seller with a 2-second delay between them. At scale:

- **10 sellers** = ~20 seconds, low risk
- **100 sellers** = ~3.5 minutes, moderate risk
- **500+ sellers** = 15+ minutes, high risk of timeouts and rate limits

**Mitigation strategy (included in this plan):**
- Increase delay from 2s to 5s between checks
- Add exponential backoff on 429 (rate limit) responses
- Stagger checks: only validate sellers whose cookies haven't been checked in the last 12 hours (up from 6)
- Add a max batch size (e.g., 50 sellers per run) so the function doesn't time out
- If a 429 is received, stop processing remaining sellers and mark them for next run

---

## Feature 1: "Update Cookies" Button

### What changes

**`src/components/SellerSettingsView.tsx`**

When the seller's TradingView is already connected (the "Connected Account" card), add an "Update Cookies" button below the disconnect option. Clicking it reveals the cookie input fields (session cookie + signed session cookie) and a "Test & Save" button -- reusing the existing `handleTestConnection` logic. On success, the connection status resets to `active` and programs are re-enabled.

This is a UI-only change -- the existing `tradingview-service` `test-connection` action already handles saving new cookies and updating status.

---

## Feature 2: Proactive Expiry Warnings

### Database migration

Add a `tradingview_cookies_set_at` timestamp column to `profiles` to track when cookies were last updated. This lets us calculate cookie age and warn before expiry.

```sql
ALTER TABLE profiles ADD COLUMN tradingview_cookies_set_at timestamptz;
```

### Edge function: `tradingview-service/actions/testConnection.ts`

After successfully saving cookies, also set `tradingview_cookies_set_at = now()`.

### Edge function: `tradingview-health-check/index.ts`

Changes:
- Increase inter-seller delay from 2s to 5s
- Change skip threshold from 6 hours to 12 hours
- Add max batch size of 50 sellers per run
- Add 429 detection: if TradingView returns 429, stop the loop early
- Add expiry warning logic: if `tradingview_cookies_set_at` is older than 25 days, set `tradingview_connection_status` to `'expiring_soon'` (cookies typically last ~30 days)

### UI: `src/components/TradingViewConnectionStatus.tsx`

Add an `expiring_soon` status with a yellow/warning badge saying "Expiring Soon" and a message like "Your TradingView cookies are nearing expiration. Update them to avoid service interruption."

### UI: `src/components/SellerSettingsView.tsx`

When status is `expiring_soon`, show the cookie update fields automatically with a warning banner.

### Seller Dashboard: `src/pages/SellerDashboard.tsx`

Add `expiring_soon` to the `showConnectionWarning()` check so the top-level alert also triggers.

---

## Files to edit

| File | Change |
|------|--------|
| `src/components/SellerSettingsView.tsx` | Add "Update Cookies" toggle + fields in connected state; auto-show on `expiring_soon` |
| `src/components/TradingViewConnectionStatus.tsx` | Add `expiring_soon` status variant |
| `src/pages/SellerDashboard.tsx` | Add `expiring_soon` to warning check |
| `supabase/functions/tradingview-health-check/index.ts` | Rate limit mitigations + expiry warning logic |
| `supabase/functions/tradingview-service/actions/testConnection.ts` | Set `tradingview_cookies_set_at` on success |

### Database migration

Add `tradingview_cookies_set_at` column to `profiles`.

