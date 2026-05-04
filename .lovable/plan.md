## Fix: Subscription renewals don't extend TradingView access

### Problem
On `invoice.paid` (renewal), `handleInvoicePaid` in `supabase/functions/stripe-webhook/index.ts` only updates `script_assignments.expires_at` in the DB. It never re-calls TradingView, so TV expires the user at the original period end even though they paid for the next period.

### Fix
Update `handleInvoicePaid` (around lines 539–602) so that, for each renewed assignment, it also re-pushes the new expiration to TradingView.

Specifically, in the loop over purchases:

1. Select assignments with `id, pine_id, tradingview_username` (not just update blindly).
2. Update `expires_at` + `status: 'assigned'` in DB (existing behavior).
3. For each assignment with a valid `pine_id` and `tradingview_username`, call `triggerScriptAssignment(assignment.id, pine_id, tradingview_username, 'subscription', newExpiresAt)`.
   - This re-invokes `tradingview-service` → `assignScriptAccess` → `pine_perm/add/` with the new `expiration` timestamp, which TradingView treats as an extension.
   - The existing `assignScriptAccess` already handles `access_type: 'subscription'` + `subscription_expires_at` and writes verification details back to the assignment.
4. Skip (with a warn log) any assignment missing `pine_id`/`tradingview_username` to avoid a failed TV call — the DB row is still extended.
5. Wrap each TV call in try/catch (already done inside `triggerScriptAssignment`) so one failure doesn't block other assignments.

### Notes / non-goals
- No DB schema changes.
- `customer.subscription.deleted` revocation flow is already correct — not touched.
- `handleSubscriptionUpdate` (past_due / pause handling) is still a no-op; out of scope for this fix unless you want it included.
- No new secrets needed.

### Files changed
- `supabase/functions/stripe-webhook/index.ts` — modify `handleInvoicePaid` only.
