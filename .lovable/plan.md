
# Fix Stripe Webhook - Script Assignment Not Working

## Problem Identified
The Stripe webhook is failing with every request due to an incompatibility between the Stripe SDK and Deno's runtime:

```
SubtleCryptoProvider cannot be used in a synchronous context.
Use `await constructEventAsync(...)` instead of `constructEvent(...)`
```

**Impact**: After checkout completes, the webhook fails to:
1. Create purchase records
2. Create script assignment records
3. Grant TradingView script access to buyers

## Root Cause
The Stripe SDK v14+ in Deno requires using the **async** version of the webhook signature verification method. The current code uses `constructEvent()` (sync) instead of `constructEventAsync()` (async).

## Solution

### Change Required
Update `supabase/functions/stripe-webhook/index.ts` line 28:

**Before:**
```typescript
const event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
```

**After:**
```typescript
const event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
```

This is a one-line fix that changes the synchronous method call to its async equivalent.

## Testing Plan
After deploying the fix:
1. Complete another test checkout
2. Verify purchase record appears in the database
3. Verify script_assignment record is created with status "pending"
4. Check assignment_logs for any activity
5. Confirm TradingView access is granted (or queued for processing)

## Technical Details
- **File**: `supabase/functions/stripe-webhook/index.ts`
- **Line**: 28
- **Change**: `constructEvent` → `constructEventAsync` with `await`
- **Risk**: Low - this is the documented fix from Stripe for Deno environments
