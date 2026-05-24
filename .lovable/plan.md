# Seller Onboarding via Invite Link

## Goal
You send each new seller two things:
1. A link to `https://pinemarket.io/auth`
2. Their founder access code

They sign up, verify email, get auto-routed into the seller onboarding flow, paste the access code, and are off to the races. No other gating changes, site stays closed to the public via `/interest`.

## What works today
- `/auth` is already a public route — no gate change needed.
- `/auth` signup form already has a "I want to sell Pine Scripts" checkbox that sets `localStorage.pendingSellerOnboarding = 'true'`.
- `AuthContext` already watches for `SIGNED_IN` and redirects to `/seller/onboarding` when that flag is set.
- `SellerOnboarding` already validates the access code via `AccessCodeStep`.

## What's missing / what to change

### 1. Make the "I want to sell" checkbox more prominent on signup
Right now it's a small checkbox at the bottom of the signup form. Sellers coming from your invite email may miss it, and if unchecked they land on `/` (the buyer home) after verifying.

Change: On `/auth`, if the URL has `?sell=1`, pre-check the "I want to sell" box and show a small banner at the top ("You've been invited to sell on PineMarket — finish signup to continue setup"). You then send invitees `https://pinemarket.io/auth?sell=1` instead of plain `/auth`.

### 2. Also set the pendingSellerOnboarding flag for already-signed-up sellers who land on /auth?sell=1
Edge case: if someone already has an account and visits `/auth?sell=1`, signing in should also route them to `/seller/onboarding` (not `/`). Add the same `pendingSellerOnboarding` flag-set on the sign-in path when `?sell=1` is present.

### 3. (Optional polish) Show the access code on the onboarding page if passed via URL
If you want to skip even the copy/paste step, support `/auth?sell=1&code=ABC123` — stash the code in localStorage at signup, and `AccessCodeStep` reads + pre-fills it. This is nice-to-have, not required.

## Files touched
- `src/pages/Auth.tsx` — read `?sell=1` query param, pre-check `wantsToSell`, show invite banner, set `pendingSellerOnboarding` on sign-in too when flag present.
- `src/components/SellerOnboarding/AccessCodeStep.tsx` — (only if doing #3) pre-fill code from localStorage.

No database changes. No new routes. No changes to `/interest` gating.

## Your onboarding workflow after this ships
1. Create an access code in Admin → Access Codes for the new seller.
2. Email them: "Sign up here: `https://pinemarket.io/auth?sell=1` — use access code `XXXX` when prompted."
3. They sign up → verify email → land on seller onboarding → paste code → connect Stripe + TradingView → start uploading.

## When you're ready to open the site publicly
Remove the `AdminRoute` wrappers in `App.tsx` (or repurpose the component). The `/interest` route can stay as a marketing fallback or be deleted.