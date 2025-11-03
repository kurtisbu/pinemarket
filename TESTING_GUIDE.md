# Testing Guide: Centralized Payment System

## Setup Complete ✅

### 1. Automated Cron Jobs (Active)
- **Daily Balance Settlement**: 9 AM UTC (moves pending → available after 7 days)
- **Weekly Payouts**: Fridays at 10 AM UTC (processes payouts ≥ $50)

### 2. Admin Dashboard
- New **Payouts** tab in Admin Dashboard
- Manual triggers for testing:
  - "Settle Pending Balances" - Force settlement immediately
  - "Process Payouts Now" - Force payout processing immediately

## Testing Workflow

### Phase 1: Test Purchase Flow

1. **Create a Test Sale**
   - Make a test purchase as a buyer
   - Check Stripe webhook logs to verify `seller_owed` is calculated
   - Verify `seller_balances` table is updated with `pending_balance`

2. **Check Seller Balance**
   - Go to seller dashboard → Settings → Payout Information
   - Verify the balance shows:
     - Pending Balance: Amount from sale
     - Available Balance: $0.00
     - Total Earned: Amount from sale

### Phase 2: Test Balance Settlement

1. **Manual Settlement (Admin)**
   - Go to Admin Dashboard → Payouts tab
   - Click "Settle Pending Balances"
   - This simulates the 7-day clearance period

2. **Verify Settlement**
   - Check seller's payout settings again
   - Pending balance should move to Available balance

**OR**

1. **Wait for Real 7-Day Clearance**
   - Create a purchase
   - Wait 7 days
   - Daily cron job will automatically settle it

### Phase 3: Test Payout Processing

1. **Setup Payout Info (Seller)**
   - Go to Settings → Payout Information
   - Enter bank account details:
     - Account holder name
     - Bank name
     - Routing number
     - Account number
   - Save (will be marked as "Unverified")

2. **Manual Verification (Admin)**
   - Query database to verify seller payout info:
   ```sql
   SELECT * FROM seller_payout_info WHERE user_id = 'seller-uuid';
   ```
   - Manually set `is_verified = true` for testing:
   ```sql
   UPDATE seller_payout_info 
   SET is_verified = true 
   WHERE user_id = 'seller-uuid';
   ```

3. **Trigger Payout (Admin)**
   - Go to Admin Dashboard → Payouts tab
   - Ensure seller has:
     - Available balance ≥ $50
     - Verified payout info
   - Click "Process Payouts Now"

4. **Verify Payout Record**
   - Check "Recent Payouts" table
   - Should show:
     - Status: "completed" (simulated)
     - Transfer ID: `sim_transfer_*`
     - Amount deducted from available balance

### Phase 4: Check Edge Function Logs

1. **Stripe Webhook Logs**
   ```
   Dashboard → Functions → stripe-webhook → Logs
   ```
   - Look for: "Balance updated for seller"
   - Verify `seller_owed` calculation

2. **Settle Balances Logs**
   ```
   Dashboard → Functions → settle-balances → Logs
   ```
   - Check after manual trigger
   - Should show number of sellers settled

3. **Process Payouts Logs**
   ```
   Dashboard → Functions → process-payouts → Logs
   ```
   - Look for: "Processing payout for seller"
   - Verify bank transfer simulation

## Database Queries for Testing

### Check Seller Balance
```sql
SELECT 
  sb.*,
  p.display_name,
  p.username
FROM seller_balances sb
JOIN profiles p ON p.id = sb.seller_id
WHERE sb.seller_id = 'seller-uuid';
```

### Check Pending Purchases (Ready for Settlement)
```sql
SELECT 
  id,
  seller_id,
  seller_owed,
  status,
  updated_at,
  NOW() - updated_at as age
FROM purchases
WHERE status = 'completed'
  AND updated_at < NOW() - INTERVAL '7 days'
ORDER BY updated_at DESC;
```

### Check Recent Payouts
```sql
SELECT 
  payout.*,
  p.display_name
FROM payouts payout
JOIN profiles p ON p.id = payout.seller_id
ORDER BY payout.created_at DESC
LIMIT 10;
```

### Check Sellers Eligible for Payout
```sql
SELECT 
  sb.seller_id,
  p.display_name,
  sb.available_balance,
  spi.is_verified,
  spi.payout_method
FROM seller_balances sb
JOIN profiles p ON p.id = sb.seller_id
LEFT JOIN seller_payout_info spi ON spi.user_id = sb.seller_id
WHERE sb.available_balance >= 50
ORDER BY sb.available_balance DESC;
```

## Expected Flow Timeline

### Immediate (On Purchase)
- Stripe payment captured
- Webhook creates purchase record
- `seller_owed` calculated (price - 10% platform fee)
- `pending_balance` updated in `seller_balances`

### Day 7 (After Purchase)
- Daily cron job runs at 9 AM UTC
- `settle-balances` edge function called
- Pending balance → Available balance
- Seller can now receive payout

### Next Friday (10 AM UTC)
- Weekly payout cron job runs
- `process-payouts` edge function called
- All sellers with available ≥ $50 processed
- Stripe transfers created (currently simulated)
- Available balance → 0
- Total paid out increased

## Known Limitations (To Implement)

### 1. Stripe Transfers (Currently Simulated)
**Current**: Creates payout record with `sim_transfer_*` ID
**Needed**: Implement real Stripe transfers

```typescript
// In process-payouts/index.ts
const transfer = await stripe.transfers.create({
  amount: Math.round(seller.available_balance * 100),
  currency: 'usd',
  destination: seller_stripe_account_id, // Need to collect
  transfer_group: `payout_${Date.now()}`
});
```

### 2. Bank Account Verification
**Current**: Manual admin approval (set `is_verified = true`)
**Needed**: 
- Integrate Stripe Identity or Plaid
- Automated micro-deposit verification
- Or admin approval workflow UI

### 3. PayPal Integration
**Current**: Not implemented
**Needed**: PayPal Payouts API integration

### 4. Failed Payout Handling
**Current**: Logs error, marks as failed
**Needed**: 
- Retry logic
- Email notifications
- Admin review queue

## Success Criteria

✅ Purchase creates pending balance
✅ Settlement moves pending to available after 7 days
✅ Payout processes when available ≥ $50
✅ Seller can view balance in dashboard
✅ Admin can monitor all balances and payouts
✅ Admin can manually trigger settlement/payouts
✅ Cron jobs are scheduled and active

## Next Steps

1. **Test the full flow** using the steps above
2. **Implement real Stripe transfers** (replace simulation)
3. **Add bank verification workflow** (admin UI or automated)
4. **Set up monitoring/alerts** for failed payouts
5. **Update Terms of Service** for fund holding policy
6. **Consider regulatory compliance** for your jurisdiction

## Support & Debugging

If something doesn't work:

1. Check edge function logs (links in Admin Dashboard)
2. Query database tables directly (queries above)
3. Use Admin Dashboard manual triggers for testing
4. Check console logs in browser dev tools
5. Verify cron jobs are running: `SELECT * FROM cron.job;`

## Production Checklist

Before going live:

- [ ] Replace simulated transfers with real Stripe API calls
- [ ] Implement bank account verification
- [ ] Set up error monitoring (Sentry, etc.)
- [ ] Configure email notifications for sellers
- [ ] Update legal documents (ToS, payment terms)
- [ ] Test with small real transactions
- [ ] Have customer support process ready
- [ ] Set up accounting/bookkeeping system
- [ ] Review money transmission laws for your region
- [ ] Consider escrow account requirements
