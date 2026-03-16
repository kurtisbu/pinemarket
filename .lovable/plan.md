

# Production Readiness Review

After a thorough audit of the codebase, here are the issues to fix before inviting developers.

---

## Critical Issues

### 1. Dead navigation links (href="#")
The **Header** nav has 3 placeholder links ("Categories", "Top Sellers", "New") and the **Footer** has 12 placeholder links -- all pointing to `href="#"`. These look broken to real users.

**Fix:** Wire Header links to real routes (`/browse?category=...`, `/creators`, `/browse?sort=newest`). For Footer, either link to real pages or remove sections that don't have destinations yet. Update copyright from "2024" to "2025".

### 2. Broken route reference: `/seller-dashboard`
`CreatePackage.tsx` navigates to `/seller-dashboard` on success, and `StripeConnectBanner.tsx` links to `/seller-dashboard`. But the actual route is `/dashboard`. These will 404.

**Fix:** Replace all `/seller-dashboard` references with `/dashboard`.

### 3. Shopping cart button does nothing
The Header has a `ShoppingCart` icon button with no `onClick` handler. It's a dead UI element.

**Fix:** Either remove it (if there's no cart feature) or link it to `/my-purchases`.

### 4. Hero buttons do nothing
"Browse Scripts" and "Start Selling" buttons in the Hero have no `onClick` handlers.

**Fix:** Wire "Browse Scripts" to `/browse` and "Start Selling" to `/seller/onboarding` or `/auth`.

### 5. Unused component: `PaymentSecurityValidator.tsx`
Never imported anywhere. Contains simulated rate-limit checks (`Math.random()`) -- not real security.

**Fix:** Delete it.

### 6. FeaturedPrograms shows fake data
When no programs exist, `FeaturedPrograms.tsx` renders 6 hardcoded sample programs with fake names ("TradePro", "ScalpKing") and fake stats. Clicking them navigates to `/program/sample-1` which will show "Program Not Found". This is misleading for real users.

**Fix:** Show a proper empty state instead of fake data. Something like "No programs listed yet -- be the first to publish!"

### 7. User role shown in dropdown menu
The Header dropdown shows `Role: admin` or `Role: user` to every user. This leaks internal information and looks unprofessional.

**Fix:** Remove the role display line from the dropdown, or only show it for admins.

---

## Moderate Issues

### 8. Debug console.log statements everywhere
`AdminDashboard.tsx` has 10+ console.log calls, `SellerDashboard.tsx` has 5, `ProgramDetail.tsx` has 3, `Header.tsx` has 1, `ProgramPurchaseSection.tsx` has 1, `AuthContext.tsx` has 1. These leak implementation details in the browser console.

**Fix:** Remove or guard debug logs behind a `DEV` flag.

### 9. Auth page signup requires TradingView username
The signup form marks TradingView username as "Required" with hardcoded blue background styling (`bg-blue-50 border-blue-200`) that doesn't respect dark mode.

**Fix:** Make TradingView username optional at signup (it can be added later in profile settings). Fix the hardcoded colors.

### 10. No password reset flow
There is no "Forgot Password" link or `/reset-password` page. Users who forget their password have no recovery path.

**Fix:** Add a forgot password link on the Auth page and create a `/reset-password` route.

### 11. No mobile menu
The Header nav links are `hidden md:flex`. On mobile, users only see the logo, cart icon, and user icon -- no way to navigate to Browse, Categories, etc.

**Fix:** Add a mobile hamburger menu.

### 12. Duplicate RLS policies on `purchases` table
There are 4 duplicate SELECT policies: "Buyers can see their own purchases" / "Buyers can view their own purchases" and "Sellers can see purchases of their programs" / "Sellers can view purchases of their programs". These are redundant.

**Fix:** Drop the duplicates via migration.

---

## Minor Polish

### 13. NotFound page uses hardcoded colors
`bg-gray-100`, `text-gray-600`, `text-blue-500` instead of theme tokens. Doesn't match the rest of the app.

### 14. `seller_payout_info` table stores bank account numbers
Per the project memory, all manual bank account collection was removed in favor of Stripe Connect, but the table still exists with `bank_account_number`, `bank_routing_number` columns. Consider dropping this table if unused.

### 15. `ProfileSettings.tsx` has no Footer
Most pages include Footer; this one doesn't.

---

## Recommended Implementation Order

**Phase 1 -- Blockers (do first):**
1. Fix dead `href="#"` links in Header and Footer
2. Fix `/seller-dashboard` broken route references
3. Wire Hero buttons
4. Remove or link shopping cart button
5. Replace fake FeaturedPrograms data with empty state
6. Delete `PaymentSecurityValidator.tsx`
7. Remove role display from user dropdown

**Phase 2 -- Important:**
8. Add forgot password / reset password flow
9. Strip debug console.logs
10. Make TradingView username optional at signup, fix dark mode colors
11. Clean up duplicate RLS policies

**Phase 3 -- Polish:**
12. Add mobile hamburger menu
13. Fix NotFound page styling
14. Add Footer to ProfileSettings
15. Update copyright year

---

## Technical Details

### Files to delete (1):
- `src/components/PaymentSecurityValidator.tsx`

### Files to edit:
- `src/components/Header.tsx` -- Fix nav links, remove cart or link it, remove role display
- `src/components/Footer.tsx` -- Wire links or remove placeholders, update copyright
- `src/components/Hero.tsx` -- Wire buttons
- `src/components/FeaturedPrograms.tsx` -- Replace fake data with empty state
- `src/pages/CreatePackage.tsx` -- Fix `/seller-dashboard` to `/dashboard`
- `src/components/StripeConnectBanner.tsx` -- Fix `/seller-dashboard` to `/dashboard`
- `src/pages/SellerDashboard.tsx` -- Fix self-reference route, strip console.logs
- `src/pages/AdminDashboard.tsx` -- Strip console.logs
- `src/pages/ProgramDetail.tsx` -- Strip console.logs
- `src/pages/Auth.tsx` -- Make TV username optional, fix hardcoded colors, add forgot password link
- `src/pages/NotFound.tsx` -- Use theme tokens
- `src/contexts/AuthContext.tsx` -- Strip console.log

### New files:
- `src/pages/ResetPassword.tsx` -- Password reset page
- Route added to `src/App.tsx`

### Database migration:
- Drop duplicate RLS policies on `purchases` table

