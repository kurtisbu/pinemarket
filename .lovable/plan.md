## Goal

Implement a "split" platform fee like Fiverr:
- Buyer pays `list_price + buyer_fee_percent × list_price`
- Seller receives `list_price − seller_fee_percent × list_price`
- Platform keeps the sum of both fees

Defaults: 5% buyer fee + 5% seller fee. Both configurable per-seller (admin override) like the existing `custom_platform_fee_percent`.

Example for $100 listing: buyer pays $105, seller gets $95, platform keeps $10.

---

## 1. Database changes (migration)

- Add column `profiles.custom_buyer_fee_percent numeric NULL` (NULL = use default).
- Rename existing concept in our heads: `custom_platform_fee_percent` becomes the **seller-side** fee (no schema rename — keep column to avoid breakage; it already represents what the seller pays).
- Add a new SQL function `get_buyer_fee_rate(seller_id uuid) returns numeric` mirroring `get_seller_fee_rate`, defaulting to `5.0`.
- Update `get_seller_fee_rate` default from `10.0` → `5.0` (since the platform now also collects on the buyer side). *Confirm this with user before applying — see Open Questions.*
- Update `get_featured_creators_with_stats()` and `toggle_creator_featured_status(...)` to include/accept `custom_buyer_fee_percent`.

## 2. Checkout edge function (`supabase/functions/create-checkout/index.ts`)

- Fetch both rates: seller fee (existing RPC) and new buyer fee.
- Compute:
  - `listAmount = price.amount`
  - `buyerFeeAmount = round(listAmount × buyerFeePct / 100, 2)`
  - `totalCharged = listAmount + buyerFeeAmount`
  - `sellerFeeAmount = round(listAmount × sellerFeePct / 100, 2)`
  - `applicationFee = buyerFeeAmount + sellerFeeAmount` (in cents for Stripe)
- Stripe line items: instead of using the existing `stripe_price_id` directly, build a one-off `price_data` line item with `unit_amount = totalCharged` so the buyer is actually charged the inflated amount. (For subscriptions we need a Stripe Price object — plan to create a "buyer-inclusive" Stripe Price on the fly via `stripeEnsure.ts`, cached per (priceId, buyerFeePct) in a new column `stripe_buyer_inclusive_price_id` on `program_prices` / `package_prices`.)
- For `payment` mode: set `payment_intent_data.application_fee_amount = applicationFee` (cents).
- For `subscription` mode: Stripe only allows `application_fee_percent` (a single percent of total). Compute it as `applicationFee / totalCharged × 100` and pass that.
- Store both `buyer_fee_percent` and `seller_fee_percent` in session metadata for reconciliation.

## 3. Stripe webhook (`supabase/functions/stripe-webhook/index.ts`)

- Read `buyer_fee_percent` and `seller_fee_percent` from metadata.
- Compute `platformFee = listAmount × (buyer+seller)/100`, `sellerOwed = listAmount − sellerCut`.
- Persist `purchase.amount = listAmount` (keep the listed price as the canonical product amount), and store the buyer-side fee separately. Add columns:
  - `purchases.buyer_fee numeric not null default 0`
  - `purchases.total_charged numeric` (what the buyer actually paid)
  - keep existing `platform_fee` = total platform take (buyer + seller fee).

## 4. UI changes

- **`ProgramPriceSelector.tsx` / `ProgramPurchaseSection.tsx`**: show a small breakdown under each price option:
  - Line 1: `$100.00`
  - Line 2 (muted, small): `+ $5.00 platform fee`
  - Line 3 (bold): `Total: $105.00`
- **Browse / `ProgramCard.tsx`**: keep displaying the list price (no fee) so cards stay clean.
- **`MyPurchases.tsx`**: show `Total paid` (= `total_charged`) plus a tooltip breakdown.
- **Seller dashboard / payouts**: unchanged — sellers continue to see `seller_owed`, which already nets out their fee.
- **Admin `AdminFeaturedCreators.tsx`**: add a second input for "Buyer Fee %" alongside the existing seller fee input.

## 5. Backwards compatibility

- Existing Stripe Price IDs stored on `program_prices.stripe_price_id` are not used for the buyer-charge anymore (one-time) or are wrapped (subscription). Old purchases keep working since we only changed forward-flow logic.

---

## Open questions before implementing

1. Should I lower the existing default seller fee from 10% → 5% so total platform take stays ~10%, or keep 10% seller + add 5% buyer (15% total)?
2. Should the buyer-fee line be visible on the public product page (transparency) or only revealed at checkout (Fiverr-style)?
3. Per-seller override for the buyer fee, or a single global rate for everyone?

I'll ask these as multiple-choice once you approve the overall direction.
