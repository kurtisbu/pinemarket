## Seller Discord Access for Buyers

Ship a simple invite-link system now, structured so we can layer an auto-role bot on top later without schema rework.

### What sellers get
- **Profile setting** — one "Default Discord invite URL" field on their seller profile (in Settings). Used for every product unless overridden.
- **Per-product override** — optional "Discord invite URL" field on program and package forms (Sell Script + Edit Program + Create/Edit Package). Blank = fall back to seller default.
- Optional short description ("What's inside our Discord") shown next to the invite.

### What buyers get
- After a successful purchase, a **"Join the Seller's Discord"** card appears:
  - On the product page (only when the buyer owns it)
  - On the `/my-purchases` page for that item
  - In the Stripe-success confirmation flow
- The purchase confirmation UI shows the invite alongside the existing "Instant Access" TradingView delivery info.
- Card shows seller's display name, Discord icon, description, and a "Join Discord" button opening the invite in a new tab.

### Data model (designed for future bot upgrade)
- `profiles.default_discord_invite_url` (text, nullable)
- `profiles.default_discord_description` (text, nullable)
- `programs.discord_invite_url` (text, nullable) — overrides default
- `programs.discord_description` (text, nullable)
- `program_packages.discord_invite_url` (text, nullable)
- `program_packages.discord_description` (text, nullable)
- New table `discord_deliveries` (purchase_id, buyer_id, seller_id, invite_url, delivered_at, revoked_at) — records every invite handed out. Not user-visible yet, but enables:
  - Auto-revoke when a subscription ends (once the bot ships)
  - Analytics on Discord conversion
  - Migration path to bot-managed roles (swap `invite_url` for `discord_role_id`)

### Validation
- Client + server-side check that the URL matches `https://discord.gg/...` or `https://discord.com/invite/...`. Reject anything else to avoid phishing links.
- Trim whitespace, cap length at 200 chars.

### Access rules
- Anyone can read the seller's default and product-level Discord URL (needed for the buyer-facing card) — but the "Join" button only renders for owners of that purchase.
- Only the seller (or admin) can update their own defaults and product-level fields via existing RLS on `profiles` / `programs` / `program_packages`.

### Files touched
- Migration: add columns above + create `discord_deliveries` with GRANTs and RLS.
- `src/components/SellerSettingsView.tsx` (or `ProfileBasicInfo.tsx`) — default Discord fields.
- `src/components/SellScript/ProgramBasicForm.tsx` + `useSellScriptForm.ts` — per-program field.
- `src/pages/EditProgram.tsx` — same field for published programs.
- `src/pages/CreatePackage.tsx` — per-package field.
- New `src/components/DiscordAccessCard.tsx` — the buyer-facing card, with URL resolution (product > seller default).
- `src/pages/ProgramDetail.tsx` — render card when the current user owns the program.
- `src/components/UserPurchases.tsx` (and `PurchaseItem.tsx`) — render card per purchased item.
- `src/lib/discord.ts` — URL validation helper.

### Future upgrade path (not built now)
When ready for Whop-style behavior: add a `discord-bot` edge function + OAuth flow, extend `discord_deliveries` with `discord_user_id` and `discord_role_id`, and swap the invite card for a "Link your Discord" button. No data migration needed — existing columns stay as the fallback.

### Out of scope
- Discord OAuth, bot install, role assignment, auto-revoke on refund — deferred to phase 2.
- Two-way sync (Discord messages ↔ support tickets).
