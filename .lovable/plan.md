

# Fix: Subscription Expiration and Renewal Logic

## Problem Summary

Your test purchase revealed two critical issues with subscription-based script access:

### Issue 1: Assignments Have No Expiration
When you purchased a monthly subscription, the script assignments were created with:
- `access_type: 'subscription'` (correct)
- `expires_at: null` (wrong - should be 1 month from now)

The current code only sets expiration for trial access, not for subscription access.

### Issue 2: No Renewal/Extension Logic
While Stripe correctly handles recurring billing, the platform has no logic to:
- Extend `expires_at` when a subscription payment succeeds
- Track which subscription is linked to which assignments
- Properly revoke access when a subscription is canceled

---

## Solution Overview

```text
+-------------------+       +-------------------+       +-------------------+
|  Initial Purchase | ----> | Stripe Webhook    | ----> | Script Assignment |
|  (Checkout)       |       | checkout.session  |       | expires_at: +1mo  |
+-------------------+       +-------------------+       +-------------------+
                                    |
                                    v
                            Store stripe_subscription_id
                            in purchases table
                                    |
+-------------------+       +-------------------+       +-------------------+
|  Monthly Renewal  | ----> | Stripe Webhook    | ----> | Extend expires_at |
|  (Auto-charged)   |       | invoice.paid      |       | by billing period |
+-------------------+       +-------------------+       +-------------------+
                                    |
+-------------------+       +-------------------+       +-------------------+
|  Cancellation     | ----> | Stripe Webhook    | ----> | Revoke Access     |
|  (User cancels)   |       | subscription.     |       | (set to expired)  |
|                   |       | deleted           |       |                   |
+-------------------+       +-------------------+       +-------------------+
```

---

## Implementation Steps

### Step 1: Add `stripe_subscription_id` Column to Purchases Table

The purchases table needs to track which Stripe subscription it belongs to for renewal processing.

```sql
ALTER TABLE purchases 
ADD COLUMN stripe_subscription_id TEXT;

-- Index for quick lookup during renewal webhooks
CREATE INDEX idx_purchases_stripe_subscription_id 
ON purchases(stripe_subscription_id);
```

### Step 2: Update Webhook - Set Expiration on Initial Assignment

Modify `stripe-webhook/index.ts` to:
1. Retrieve subscription details from Stripe to get `current_period_end`
2. Pass subscription period end date to the assignment creation
3. Store `stripe_subscription_id` in the purchase record

For subscriptions, the assignment's `expires_at` should be set to the subscription's `current_period_end` timestamp.

### Step 3: Update Webhook - Add Subscription Renewal Handler

Add proper handling for `invoice.paid` events (subscription renewals):
1. Look up the purchase by `stripe_subscription_id`
2. Retrieve the updated subscription from Stripe
3. Update all related script assignments with the new `current_period_end`

### Step 4: Update Webhook - Fix Subscription Cancellation Handler

Fix `handleSubscriptionDeleted()` to:
1. Look up purchases by `stripe_subscription_id` (not `payment_intent_id`)
2. Update assignments to `status: 'revoked'` and set `expires_at` to now

### Step 5: Update Assignment Logic for Subscription Expiration

Modify `assignScriptAccess.ts` to handle subscription access type:
- Accept `expires_at` as a parameter when `access_type === 'subscription'`
- Set the expiration on TradingView if their API supports it (or handle expiration on our side only)

---

## Technical Details

### Changes to `stripe-webhook/index.ts`

**In `handleCheckoutCompleted`:**
```typescript
// After getting session metadata, retrieve subscription details
if (mode === 'subscription' && session.subscription) {
  const subscription = await stripe.subscriptions.retrieve(session.subscription);
  const expiresAt = new Date(subscription.current_period_end * 1000).toISOString();
  
  // Store subscription ID with purchase
  // Pass expiresAt to script assignment creation
}
```

**New `handleInvoicePaid` function:**
```typescript
async function handleInvoicePaid(invoice: any, supabaseAdmin: any) {
  const subscriptionId = invoice.subscription;
  if (!subscriptionId) return;
  
  // Get subscription to find new period end
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const newExpiresAt = new Date(subscription.current_period_end * 1000);
  
  // Find purchase by subscription ID
  const { data: purchases } = await supabaseAdmin
    .from('purchases')
    .select('id')
    .eq('stripe_subscription_id', subscriptionId);
  
  // Extend all related script assignments
  for (const purchase of purchases) {
    await supabaseAdmin
      .from('script_assignments')
      .update({ expires_at: newExpiresAt.toISOString() })
      .eq('purchase_id', purchase.id);
  }
}
```

**Fix `handleSubscriptionDeleted`:**
```typescript
async function handleSubscriptionDeleted(subscription: any, supabaseAdmin: any) {
  // Use stripe_subscription_id, not payment_intent_id
  const { data: purchases } = await supabaseAdmin
    .from('purchases')
    .select('id')
    .eq('stripe_subscription_id', subscription.id);

  for (const purchase of purchases) {
    await supabaseAdmin
      .from('script_assignments')
      .update({ 
        status: 'revoked',
        expires_at: new Date().toISOString()
      })
      .eq('purchase_id', purchase.id);
      
    // Optionally: trigger TradingView access revocation
  }
}
```

### Changes to `assignScriptAccess.ts`

Accept and use `subscription_expires_at` parameter:
```typescript
const { 
  pine_id, 
  tradingview_username, 
  assignment_id, 
  access_type, 
  trial_duration_days,
  subscription_expires_at  // New parameter
} = payload;

// In performAssignment:
let expirationDate = null;
if (accessType === 'trial' && trialDurationDays) {
  expirationDate = new Date(Date.now() + (trialDurationDays * 24 * 60 * 60 * 1000));
} else if (accessType === 'subscription' && subscription_expires_at) {
  expirationDate = new Date(subscription_expires_at);
}
```

---

## How Recurring Billing Works

With these changes, here's the complete subscription lifecycle:

1. **Initial Purchase**: User selects monthly subscription, pays first month
   - Stripe creates subscription with `current_period_end` = 1 month from now
   - Webhook creates purchase with `stripe_subscription_id`
   - Script assignments created with `expires_at` = `current_period_end`

2. **Automatic Renewal** (after 1 month):
   - Stripe automatically charges the card
   - Stripe sends `invoice.paid` webhook event
   - Your webhook updates all related assignments with new `expires_at`

3. **Cancellation**:
   - User cancels via Stripe billing portal
   - Stripe sends `customer.subscription.deleted` webhook
   - Your webhook revokes access by updating assignment status

---

## Files to Modify

1. **Database Migration**: Add `stripe_subscription_id` column to `purchases`
2. **`supabase/functions/stripe-webhook/index.ts`**: 
   - Set expiration on initial subscription purchase
   - Add `invoice.paid` handler for renewals
   - Fix `subscription.deleted` handler
3. **`supabase/functions/tradingview-service/actions/assignScriptAccess.ts`**: Accept subscription expiration parameter

---

## Cleanup Note

The existing `supabase/functions/subscription-webhook/index.ts` appears to be an older/parallel implementation that uses different tables (`user_subscriptions`, `subscription_access`). After this fix, you may want to:
- Delete `subscription-webhook` if unused
- Or consolidate both approaches if you need the separate tables

