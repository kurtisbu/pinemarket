# Complete Migration Plan: Stripe Connect → Centralized Payment Processing

## Overview
Transition from Stripe Connect (direct seller payouts) to centralized payment collection with scheduled disbursements.

## ✅ Phase 1: Database Schema (COMPLETED)

### New Tables Created
- **seller_payout_info**: Stores seller bank/payment information
- **seller_balances**: Tracks available, pending, and total earnings
- **payouts**: Records disbursement history

### Database Functions Created
- `update_seller_balance()`: Updates seller balances on sales/payouts
- `settle_pending_balance()`: Moves pending to available balance after clearance

### Key Fields Added
- `purchases.seller_owed`: Amount owed to seller after platform fee

## ✅ Phase 2: Payment Processing (COMPLETED)

### Updated Files
1. **stripe-webhook/index.ts**
   - Now updates `seller_balances` instead of creating Stripe transfers
   - Tracks `seller_owed` amount on each purchase
   - Pending balance moved to available after 7-day clearance

### New Edge Functions
1. **process-payouts/index.ts**
   - Processes weekly payouts for sellers with $50+ available balance
   - Creates Stripe transfers to seller bank accounts
   - Updates payout records and seller balances

2. **settle-balances/index.ts**
   - Moves pending balance to available after 7-day clearance period
   - Should run daily via cron job

## ✅ Phase 3: UI Components (COMPLETED)

### New Components
1. **SellerPayoutSettings.tsx**
   - Balance overview (available, pending, total earned)
   - Payout method configuration (Bank Transfer/PayPal)
   - Bank account information collection
   - Replaces StripeConnectSettings

### Updated Components
1. **SellerSettingsView.tsx**
   - Now uses SellerPayoutSettings instead of StripeConnectSettings

## 📋 Phase 4: Implementation Steps (ACTION REQUIRED)

### 4.1 Set Up Automated Jobs

Create cron jobs for automated processing:

#### Daily Balance Settlement (9 AM UTC)
```sql
SELECT cron.schedule(
  'settle-pending-balances',
  '0 9 * * *', -- Daily at 9 AM UTC
  $$
  SELECT net.http_post(
    url:='https://zympnpibhohnxsnbxtaf.supabase.co/functions/v1/settle-balances',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb,
    body:=concat('{"time": "', now(), '"}')::jsonb
  ) as request_id;
  $$
);
```

#### Weekly Payout Processing (Fridays 10 AM UTC)
```sql
SELECT cron.schedule(
  'process-weekly-payouts',
  '0 10 * * 5', -- Every Friday at 10 AM UTC
  $$
  SELECT net.http_post(
    url:='https://zympnpibhohnxsnbxtaf.supabase.co/functions/v1/process-payouts',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb,
    body:=concat('{"time": "', now(), '"}')::jsonb
  ) as request_id;
  $$
);
```

### 4.2 Seller Migration Communication

Email all existing sellers:
```
Subject: Important: Updated Payout Process

We're simplifying how you get paid!

What's changing:
- No more Stripe Connect account required
- Just provide your bank account or PayPal info
- Weekly payouts every Friday (minimum $50)
- 7-day clearance period for buyer protection

Action needed:
1. Go to Settings → Payout Information
2. Enter your bank account details
3. Your earnings will automatically be paid out weekly

Your existing balance will be transferred to the new system.
```

### 4.3 Admin Dashboard Updates (TODO)

Create admin tools for:
- Manual payout triggering
- Payout verification/approval
- Balance adjustments
- Failed payout management

### 4.4 Stripe Payout Implementation (TODO)

Currently simulated - needs production implementation:

```typescript
// In process-payouts/index.ts - Replace simulation with:

// 1. Create Stripe Transfer
const transfer = await stripe.transfers.create({
  amount: Math.round(seller.available_balance * 100), // Convert to cents
  currency: 'usd',
  destination: seller_stripe_account_id,
  transfer_group: `payout_${Date.now()}`,
});

// 2. Update payout record with transfer ID
await supabaseClient
  .from('payouts')
  .update({
    status: 'completed',
    stripe_transfer_id: transfer.id,
    completed_at: new Date().toISOString()
  })
  .eq('id', payout.id);
```

### 4.5 Bank Account Verification (TODO)

Implement bank account verification:
- Use Stripe Identity or Plaid for verification
- Mark accounts as `is_verified` after successful verification
- Only process payouts for verified accounts

## 🎯 Key Differences: Before & After

### Before (Stripe Connect)
- ✅ Sellers need Stripe Connect account
- ✅ Direct payouts (2 days)
- ✅ 5-10% platform fee
- ✅ Platform never holds funds
- ❌ Complex seller onboarding
- ❌ Requires Stripe access globally

### After (Centralized)
- ✅ Simple bank info collection
- ✅ Weekly scheduled payouts (Fridays)
- ✅ 10% platform fee
- ✅ 7-day clearance for buyer protection
- ✅ Accessible to more sellers worldwide
- ❌ Platform holds funds temporarily
- ❌ More financial liability for platform

## 🚀 Deployment Checklist

- [x] Database migration completed
- [x] Edge functions created
- [x] UI components updated
- [ ] Set up cron jobs for automated processing
- [ ] Implement real Stripe transfers (currently simulated)
- [ ] Add bank account verification
- [ ] Create admin payout management dashboard
- [ ] Test payout flow end-to-end
- [ ] Migrate existing Stripe Connect sellers
- [ ] Send communication to all sellers
- [ ] Update Terms of Service for fund holding
- [ ] Ensure compliance with local money transmission laws

## ⚠️ Important Considerations

### Financial/Legal
- Platform now holds funds - may require money transmitter license
- Need proper accounting for held funds
- Tax implications for held revenue
- Escrow account considerations

### Technical
- Monitor failed payouts and retry logic
- Handle bank account validation errors
- Implement fraud detection
- Set up alerts for large balance accumulations

### User Experience
- Weekly payout schedule (vs 2-day with Connect)
- Minimum payout threshold ($50)
- Clear communication about clearance periods
- Support for international sellers

## 📊 Monitoring & Alerts

Set up monitoring for:
- Failed payout attempts
- Large balance accumulations (>$10k)
- Unusual payout patterns
- Bank account verification failures
- Daily settlement job failures

## 💰 Expected Platform Impact

### Revenue
- Same 10% platform fee on all transactions
- Hold 7 days of revenue in escrow at any time
- Potential interest earnings on held funds

### Operations
- Weekly manual payout review recommended
- Customer support for payout issues
- Bank account verification support
- Fraud monitoring

## 🔄 Rollback Plan

If needed, to rollback:
1. Stop cron jobs
2. Re-enable StripeConnectSettings component
3. Reverse database migration
4. Process any pending payouts manually
5. Communicate with affected sellers

## Next Steps

1. **Review this plan** - Ensure it aligns with business goals
2. **Set up cron jobs** - Enable automated processing
3. **Implement Stripe transfers** - Replace simulation with real transfers
4. **Test thoroughly** - Run through complete payout cycle
5. **Migrate sellers** - Communication and data migration
6. **Go live** - Enable for all new sellers

## Questions to Consider

1. Do we need regulatory approval for holding funds?
2. What's our fraud prevention strategy?
3. How do we handle chargebacks?
4. International seller support strategy?
5. Tax reporting requirements?

---

**Status**: Database and code changes complete. Awaiting cron job setup and production Stripe integration.