

# Skip Trial Period in Checkout for Users Who Already Trialed

## Problem

Line 273 of `create-checkout/index.ts` unconditionally adds `trial_period_days` to the Stripe subscription checkout whenever the program has a trial configured. This means even users who already completed their free trial see "3 days free then $49.95" instead of just "$49.95 every 3 months".

## Fix

**`supabase/functions/create-checkout/index.ts`** -- Before adding `trial_period_days` to the subscription data, check the `trial_usage` table to see if the buyer has already used their trial for this program. If they have, skip the trial period.

Change the trial block (~lines 272-275) to:

1. Query `trial_usage` for the current `user.id` + `program_id`
2. Only add `trial_period_days` if no record exists (user hasn't trialed)

This is a ~5 line change in one file. No frontend changes needed -- the "3 days free" messaging comes from Stripe's checkout page based on the session config.

