

# Remove Platform Subscription System

## What's Being Removed

The `/subscriptions` page is a **platform-level** subscription system (generic "Basic", "Pro" plans) that is separate from the **per-program** recurring pricing already built into each product page. Since per-program subscriptions handle everything needed, the platform subscription pages and components can be removed.

## Files to Delete (5 files)

| File | Purpose |
|------|---------|
| `src/pages/Subscriptions.tsx` | The `/subscriptions` page |
| `src/pages/SubscriptionSuccess.tsx` | Success callback page |
| `src/pages/SubscriptionCancel.tsx` | Cancel callback page |
| `src/components/SubscriptionPlans.tsx` | Plans grid component used only by the Subscriptions page |
| `src/components/SubscriptionPurchaseCard.tsx` | Already identified as unused in previous audit; also links to `/subscriptions` |

## Files to Edit (1 file)

**`src/App.tsx`** -- Remove the 3 imports and 3 route definitions for `/subscriptions`, `/subscription/success`, and `/subscription/cancel`.

## What's NOT Being Removed

- The `src/components/subscription/` folder (SubscriptionButton, PriceDisplay, PricingOptions, FeaturesList, subscriptionUtils) -- these power the **per-program** recurring pricing on individual product pages and are actively used.
- The `create-subscription` and `manage-subscription` edge functions -- these are used by the per-program subscription flow.
- The `subscription_plans` and `user_subscriptions` database tables -- no schema changes in this step; they can be cleaned up later if desired.

## Technical Details

The `src/App.tsx` edit removes:
- 3 import lines (Subscriptions, SubscriptionSuccess, SubscriptionCancel)
- 3 Route elements for those paths

