# Switching to a live Stripe account

You're on a bring-your-own-key Stripe setup using a single `STRIPE_SECRET_KEY` secret (plus `STRIPE_WEBHOOK_SECRET`). Everything currently in the DB — Connect accounts, Products, Prices, Subscriptions — was created in **test mode** and is **not portable** to a live Stripe account. Stripe does not migrate objects between modes or between accounts. So the cutover is really two things: (1) swap the keys, (2) reset every stale Stripe ID so the app re-creates them in live mode on demand.

The good news: your app already has the plumbing for re-creation.
- `create-program-prices` (re)creates Products + Prices for a program
- `create-checkout/stripeEnsure.ts` already self-heals missing Stripe Product/Price objects at checkout time
- Sellers go through Stripe Connect onboarding from the seller dashboard

## Current state (verified)

- 2 sellers with Connect accounts (test-mode `acct_…`)
- 4 programs with `stripe_product_id`, 9 `program_prices` rows with `stripe_price_id`
- 0 `package_prices` with Stripe IDs, 0 active subscriptions
- 5 purchases (historical, test-mode — keep for records, won't be re-charged)
- One Stripe webhook endpoint pointing at `stripe-webhook` (test mode)

## Plan

### 1. Pre-flight in Stripe (you do this in Stripe dashboard)
1. Activate the live Stripe account (business details, bank account, identity).
2. Enable **Stripe Connect** in live mode (Connect → Settings → activate). Same platform settings (Express, branding, fee structure) as test.
3. Grab the live **Secret key** (`sk_live_…`).
4. Create a new webhook endpoint in **live mode** pointing at:
   `https://zympnpibhohnxsnbxtaf.supabase.co/functions/v1/stripe-webhook`
   with the same event list as your test webhook (checkout.session.completed, invoice.paid, customer.subscription.*, account.updated, etc.). Copy its signing secret (`whsec_…`).
5. If you have a separate Connect webhook, recreate that too.

### 2. Rotate the secrets in Lovable
- Update `STRIPE_SECRET_KEY` → live key
- Update `STRIPE_WEBHOOK_SECRET` → live webhook signing secret
  (I'll trigger the secret-update prompts when you approve.)

### 3. Reset all test-mode Stripe IDs in the DB
A single migration that nulls out every Stripe identifier so the app re-creates them in live mode the next time they're needed. Nothing is deleted — just IDs cleared.

```sql
UPDATE profiles SET
  stripe_account_id = NULL,
  stripe_onboarding_completed = false,
  stripe_charges_enabled = false,
  stripe_payouts_enabled = false;

UPDATE programs SET
  stripe_product_id = NULL,
  stripe_monthly_price_id = NULL,
  stripe_yearly_price_id = NULL;

UPDATE program_prices SET
  stripe_price_id = NULL,
  stripe_buyer_inclusive_price_id = NULL;

UPDATE package_prices SET
  stripe_price_id = NULL,
  stripe_buyer_inclusive_price_id = NULL;

UPDATE subscription_plans SET stripe_price_id = NULL;
```

Historical `purchases` / `payouts` rows are left untouched (they reference test-mode IDs but are read-only history; no live action will be taken against them).

### 4. Re-onboard sellers
Because we cleared `stripe_account_id`, the seller dashboard's Stripe Connect card will show "Connect Stripe Account" again. Each seller (currently 2) goes through onboarding once — this creates a new **live** `acct_…` and the existing edge function (`stripe-connect` → `create-connect-account`) handles it.

You should notify your 2 sellers ahead of time: "We're migrating to live payments — please reconnect Stripe in your dashboard."

### 5. Re-create Products/Prices
Two options, you can pick:

- **Lazy (recommended)** — do nothing. The next time a buyer hits checkout or a seller saves a program, `create-program-prices` / `stripeEnsure.ts` will create the live-mode Product + Price automatically. Zero manual work.
- **Eager** — I add a small admin button "Sync all programs to Stripe" that loops over programs and invokes `create-program-prices` for each. Useful only if you want everything pre-created before any buyer traffic. Tell me if you want this.

### 6. Smoke test in live mode
1. Sign in as a seller → reconnect Stripe → verify "Ready to Receive Payments".
2. Open a program → edit & save (forces price recreation) → confirm new `price_…` in DB starts with live prefix.
3. As a test buyer (real card, small amount, you can refund), run a one-time purchase end-to-end.
4. Run a recurring purchase, then cancel from Stripe dashboard to confirm `customer.subscription.deleted` webhook revokes access.
5. Check Stripe → Developers → Webhooks → signed events succeeding (200s).
6. Run `process-payouts` manually (or wait for cron) and confirm a transfer lands in a seller's live Connect account.

### 7. Cleanup
- In Stripe **test** dashboard, you can leave the old webhook endpoint or delete it — your app no longer talks to test mode.
- Keep using Stripe's test mode toggle in their dashboard for any future debugging; just don't point the app at it.

## Risks / things to know

- **Test-mode purchase history stays referenced by dead IDs.** That's fine for display — just don't try to refund/cancel those from the live dashboard (they don't exist there). If you want, I can mark pre-cutover purchases with a `legacy_test_mode = true` flag for clarity.
- **Connect accounts are not transferable.** Sellers must re-onboard. There's no API to "move" a test `acct_…` to live.
- **Cron jobs** (`process-payouts`, `settle-balances`, `tradingview-health-check`, `trial-cleanup`) just read `STRIPE_SECRET_KEY` from env, so they'll switch automatically once the secret is rotated. No code change.
- **Custom domain** (`pinemarket.io`) doesn't affect Stripe — webhooks use the Supabase functions URL.

## What I'll do when you approve

1. Trigger `update_secret` prompts for `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` (you paste the live values).
2. Create the migration in step 3 (reset Stripe IDs).
3. Optionally, add the "Sync all programs to Stripe" admin button if you pick the eager option.
4. Walk you through the smoke test.

No frontend code changes are required — the app already handles the "no Stripe IDs yet" path everywhere.
