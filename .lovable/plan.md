## Problem

`AdminFeaturedCreators.tsx` filters profiles by `role = 'seller'`, but no profile in the DB has that role (only `'user'` and `'admin'`). So the "All Creators" section is always empty.

In this project a "creator" isn't a profile role — it's anyone who actually sells: has programs, a Stripe Connect account, or is already featured.

## Changes

### 1. New DB function (migration)

`get_all_creators_with_stats()` — admin-only, SECURITY DEFINER, `SET search_path = public`.

Returns the same columns as `get_featured_creators_with_stats` but for any profile matching:
- has at least one row in `programs` (any status), OR
- has `stripe_account_id IS NOT NULL`, OR
- `is_featured = true`

Ordered by `is_featured DESC, featured_priority DESC, created_at DESC`.

Raises if caller is not admin (`has_role(auth.uid(), 'admin')`).

### 2. `src/components/AdminFeaturedCreators.tsx`

- Replace the `from('profiles').eq('role', 'seller')` query in `fetchAllCreators` with `supabase.rpc('get_all_creators_with_stats')`.
- Drop the manual stats defaulting (RPC already returns real stats).
- Show a friendly empty state if no creators exist yet.

No other files affected. No Stripe or RLS changes needed.