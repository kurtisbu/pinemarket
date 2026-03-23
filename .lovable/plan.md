

# Move Free Trial Into the Purchase Flow

## What Changes

The standalone "Free Trial" tab (where users get access without entering payment info) will be removed. Instead, the trial will be offered **inside the Stripe Checkout** -- users enter their card, get the trial period free, and are charged only when it ends. They can cancel anytime via Stripe's billing portal before being charged.

The good news: **the backend already supports this**. The `create-checkout` edge function already adds `trial_period_days` to Stripe subscription sessions for eligible users. Stripe Checkout natively shows "X days free, then $Y" and collects card info upfront. The `manage-subscription` edge function already creates Stripe billing portal sessions for cancellation.

This is primarily a frontend cleanup.

---

## Changes

### 1. Simplify `ProgramPurchaseSection.tsx`

Remove the tabs UI, trial eligibility check, and `TrialPurchaseCard` import. The component should always render `ProgramPriceSelector` directly. If the program has a trial and the user is eligible, Stripe Checkout will automatically show the trial -- no separate UI needed.

Add a small informational banner above the price selector when the program has a trial configured and the user is eligible, e.g. "This program includes a X-day free trial. You won't be charged until the trial ends." This gives users confidence before they click checkout.

### 2. Update `ProgramPriceSelector.tsx`

Pass `trialPeriodDays` and `isTrialEligible` as optional props so it can display trial info next to the subscription pricing options (e.g. "Includes 3-day free trial" badge on recurring prices). The button text can change to "Start Free Trial" when a trial applies.

### 3. Delete `TrialPurchaseCard.tsx`

No longer needed -- the entire standalone trial flow is removed.

### 4. Remove `create-trial-access` from `stripe-connect/index.ts`

The `createTrialAccess` function and its route in the edge function are dead code once the standalone trial UI is removed. Remove the action handler and the function to keep the codebase clean.

### 5. Add cancellation link to `UserPurchases.tsx` / `MyPurchases.tsx`

Users need a way to cancel before being charged. Add a "Manage Subscription" button on active subscription purchases that calls the existing `manage-subscription` edge function to open Stripe's billing portal. Check if this already exists.

---

## Files

| File | Action |
|------|--------|
| `src/components/ProgramPurchaseSection.tsx` | Simplify -- remove tabs/trial logic, show trial info banner |
| `src/components/ProgramPriceSelector.tsx` | Add trial info display + "Start Free Trial" button text |
| `src/components/TrialPurchaseCard.tsx` | Delete |
| `supabase/functions/stripe-connect/index.ts` | Remove `create-trial-access` action and `createTrialAccess` function |
| `src/pages/MyPurchases.tsx` or `src/components/UserPurchases.tsx` | Verify/add "Manage Subscription" button for cancellation |

No database or migration changes needed. The `trial_usage` table and `check_trial_eligibility` function remain in use by `create-checkout` to gate trial eligibility server-side.

