
# Test vs Production — Same Project, Isolated Test Mode

Goal: run real end-to-end transactions against your Stripe sandbox account and manage test sellers/buyers/programs without polluting production views or triggering real payouts. Uses one Lovable project and one Supabase DB, with a `dev` GitHub branch for staging code before it hits `main`.

## How it works (high level)

- Every checkout, subscription, and Connect action can run in **live** or **sandbox** mode.
- Mode is decided per-user (an admin flag) rather than per-request, so a "test buyer" account always transacts against Stripe sandbox and a real buyer always transacts against live. No accidental cross-over.
- All test-mode rows (purchases, assignments, payouts, balances, Stripe account IDs) are tagged `is_test = true` and hidden from every public/production surface.
- A single "Wipe test data" admin button clears everything with `is_test = true` in one call.

```text
                   ┌─── live Stripe keys ──►  real Stripe account
Edge functions ────┤
                   └─── sandbox Stripe keys ►  test Stripe account
        ▲
        │  reads profiles.is_test_account
        │
   Admin toggle per user
```

## Scope of changes

### 1. Database
- Add `is_test_account boolean default false` to `profiles`.
- Add `is_test boolean default false` to: `purchases`, `script_assignments`, `payouts`, `seller_balances`, `user_subscriptions`, `trial_usage`, `assignment_logs`, `discord_deliveries`.
- Add `is_test_program boolean default false` to `programs` (auto-set from seller's `is_test_account` at insert via trigger).
- New RPC `admin_set_test_account(user_id, is_test)` — admin-only, flips the flag and clears stale Stripe IDs so the user re-onboards in sandbox mode.
- New RPC `admin_wipe_test_data()` — admin-only, deletes all rows where `is_test = true` across the tagged tables and removes test auth users (via edge function using service role).
- Update every existing "public" view/RPC to filter `is_test = false` / `is_test_program = false`:
  - `get_featured_creators_with_stats`, `get_all_creators_with_stats` (keep test rows visible only to admins with a flag)
  - Featured programs / browse / creators pages (client-side filter on `is_test_program`)
  - Discord alert triggers skip when `is_test = true`
  - Trending score calc excludes test purchases

### 2. Stripe keys
- Add secrets: `STRIPE_SECRET_KEY_TEST`, `STRIPE_WEBHOOK_SECRET_TEST`.
- Keep existing `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` for live.
- Helper `getStripeClient(isTest)` in a shared edge-function module picks the right key.
- Every Stripe-touching edge function reads the caller's `profiles.is_test_account` (or, for webhooks, the account ID prefix / metadata) and routes accordingly:
  - `create-checkout`, `create-subscription`, `manage-subscription`, `create-program-prices`, `update-program-prices`, `stripe-connect`, `stripe-webhook`, `process-payouts`, `settle-balances`.
- `stripe-webhook` accepts **two** endpoints or verifies against both secrets — simplest is: expose a second Stripe webhook in the dashboard pointing at the same function but with `?mode=test`, and pick the secret from the query param before `constructEventAsync`.

### 3. Admin UI
Extend `AdminDashboard.tsx` with a "Test Environment" tab:
- **Test accounts table** — lists profiles with `is_test_account = true`, with a toggle to promote/demote any user. Promoting clears their Stripe fields so they re-onboard in sandbox.
- **Seed baseline** — reuse the existing `seed-test-data` edge function; force `is_test_account = true` on every seeded user so they auto-route to sandbox Stripe.
- **Manual test accounts** — sign up normally via `/auth`, then admin flips them to test in this tab.
- **Wipe test data** — one button that calls `admin_wipe_test_data()` + edge function to purge test auth users.
- **Status banner** — sitewide banner ("You are signed in as a test account — transactions use Stripe sandbox") when `is_test_account = true`, so you never confuse the two.

### 4. GitHub branch workflow
- Enable **Labs → GitHub Branch Switching** in Lovable account settings.
- Create a `dev` branch on the repo. Do risky work on `dev` (via Lovable branch switch or local IDE), test against your `is_test_account` users, then merge `dev → main` to promote.
- No separate DB, so migrations are shared — write them backward-compatible (add columns nullable/defaulted, never drop until code on `main` no longer needs them).

## Workflow moving forward

1. Build/change on the `dev` branch in Lovable (or locally).
2. Sign in as a test account (or promote one from admin) → transactions hit Stripe sandbox.
3. When happy, merge `dev → main` in GitHub → prod picks it up.
4. Periodically hit **Wipe test data** to reset the sandbox side without touching live rows.

## Trade-offs to know

- **Shared DB.** A bad migration still affects prod. Mitigate by making migrations additive and by testing them on `dev` first.
- **Shared Supabase Auth.** Test users live in the same `auth.users` table; they're distinguished only by the `is_test_account` flag. The wipe function handles cleanup.
- **Public surfaces must filter.** If a new page/RPC forgets `is_test = false`, test data leaks. The plan adds filters to every existing surface, but new features need the same discipline (worth adding to memory).
- **Two Stripe webhooks.** You'll register a second endpoint in Stripe sandbox pointing at the same function with `?mode=test`.

## Files touched

- Migration: schema flags, RPCs, trigger, updated view/RPC filters.
- Edge functions: `_shared/stripe.ts` (new), `create-checkout`, `create-subscription`, `manage-subscription`, `create-program-prices`, `update-program-prices`, `stripe-connect`, `stripe-webhook`, `process-payouts`, `settle-balances`, `seed-test-data`, `discord-alerts`, plus a new `admin-wipe-test-data`.
- Client: `AdminDashboard.tsx` (+ new `AdminTestEnvironment.tsx`), a `TestModeBanner` in `App.tsx`, and filter tweaks in `Browse`, `Creators`, `FeaturedPrograms`, `FeaturedCreators`, `Index`.
- Secrets: add `STRIPE_SECRET_KEY_TEST`, `STRIPE_WEBHOOK_SECRET_TEST`.

Approve and I'll start with the migration, then the shared Stripe helper, then wire it through the edge functions and admin UI.
