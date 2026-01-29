# Stripe Connect Flow Documentation

## Overview
This document outlines the complete Stripe Connect integration for the PineMarket platform, where sellers create Stripe Connect accounts to receive direct payments with automatic platform fees.

## Architecture

### Payment Flow
1. **Platform Account**: Main Stripe account that receives platform fees
2. **Seller Accounts**: Stripe Connect Express accounts owned by sellers
3. **Payment Distribution**: Automatic using Stripe's destination charges
   - One-time payments: `application_fee_amount` (10% in cents)
   - Subscriptions: `application_fee_percent` (10%)

### Fee Structure
- **Platform Fee**: 10% of all transactions
- **Seller Receives**: 90% of transaction amount (direct to their Stripe account)
- **No Delay**: Money transfers immediately during purchase

---

## Complete User Flow

### 1. Seller Signup & Stripe Connection

#### Step 1.1: User Creates Account
- User signs up via `/auth` page
- Profile is created in `profiles` table
- Initial `stripe_account_id` is NULL

#### Step 1.2: Seller Navigates to Settings
- Go to `/seller-dashboard` → Settings tab
- `StripeConnectSettings` component displays connection status
- Shows "Connect Stripe Account" button if not connected

#### Step 1.3: Create Stripe Connect Account
**Frontend** (`src/components/StripeConnectSettings.tsx`):
```typescript
const createStripeAccount = async () => {
  const { data, error } = await supabase.functions.invoke('stripe-connect', {
    body: { action: 'create-account' }
  });
  // Saves stripe_account_id to profiles table
};
```

**Backend** (`supabase/functions/stripe-connect/index.ts`):
- Creates Stripe Express Connect account
- Updates `profiles` table with `stripe_account_id`
- Returns account ID to frontend

#### Step 1.4: Complete Stripe Onboarding
**Frontend**:
```typescript
const startOnboarding = async (accountId: string) => {
  const { data } = await supabase.functions.invoke('stripe-connect', {
    body: {
      action: 'create-account-link',
      account_id: accountId,
      refresh_url: window.location.href,
      return_url: window.location.href
    }
  });
  window.open(data.url, '_blank'); // Opens Stripe onboarding
};
```

**Backend**:
- Generates Stripe account onboarding link
- Seller completes KYC, bank details, etc. on Stripe
- Stripe updates account status automatically

#### Step 1.5: Account Status Verification
**Automatic check** in `StripeConnectSettings`:
```typescript
const checkAccountStatus = async (accountId: string) => {
  const { data } = await supabase.functions.invoke('stripe-connect', {
    body: {
      action: 'get-account-status',
      account_id: accountId
    }
  });
  // Updates: charges_enabled, payouts_enabled, onboarding_completed
};
```

**Database updates** (`profiles` table):
- `stripe_charges_enabled`: true (required for selling)
- `stripe_payouts_enabled`: true (required for payouts)
- `stripe_onboarding_completed`: true

---

### 2. Seller Publishes Content

#### Step 2.1: Navigate to Sell Page
- Seller goes to `/sell-script`
- **CRITICAL**: `SellScript.tsx` checks Stripe status on load

**Stripe Status Check** (`src/pages/SellScript.tsx`):
```typescript
useEffect(() => {
  const { data } = await supabase
    .from('profiles')
    .select('stripe_account_id, stripe_charges_enabled')
    .eq('id', user.id)
    .single();
  
  setStripeStatus({
    account_id: data.stripe_account_id,
    charges_enabled: data.stripe_charges_enabled
  });
}, [user]);
```

#### Step 2.2: Stripe Requirement Banner
**If NOT connected**:
- `StripeConnectBanner` displays at top of page
- Shows error message: "Stripe Account Required"
- Provides "Connect Stripe Account" button → links to `/seller-dashboard`
- **Submit button is DISABLED**

**If connected**:
- Banner hidden
- Form enabled
- Seller can create program

#### Step 2.3: Form Validation Before Submit
**Frontend validation** (`src/hooks/useSellScriptForm.ts`):
```typescript
const handleSubmit = async (e: React.FormEvent) => {
  // Check Stripe connection in real-time
  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_account_id, stripe_charges_enabled')
    .eq('id', user.id)
    .single();

  if (!profile?.stripe_account_id || !profile.stripe_charges_enabled) {
    toast({
      title: 'Stripe Account Required',
      description: 'You must connect and complete your Stripe account setup...',
      variant: 'destructive',
    });
    return; // Blocks submission
  }
  
  // Continue with program creation...
};
```

#### Step 2.4: Program Creation
- Program is created in `programs` table
- `seller_id` links to seller's profile
- Prices are created in `program_prices` table with `stripe_price_id`

---

### 3. Buyer Purchase Flow

#### Step 3.1: Buyer Selects Program
- Buyer views program on `/program/:id`
- Sees pricing options from `program_prices` table
- Clicks "Buy Now" or subscription button

#### Step 3.2: Create Checkout Session
**Frontend** (`src/components/PurchaseCard.tsx` → `SecurePaymentCard`):
```typescript
const { data } = await supabase.functions.invoke('create-checkout', {
  body: {
    priceId: selectedPriceId,
    successUrl: `${window.location.origin}/success`,
    cancelUrl: `${window.location.origin}/cancel`
  }
});
// Redirects to Stripe Checkout
```

**Backend Validation** (`supabase/functions/create-checkout/index.ts`):
```typescript
// Fetch price and seller Stripe status
const { data: price } = await supabaseClient
  .from('program_prices')
  .select(`
    *,
    programs (
      id, seller_id,
      profiles!programs_seller_id_fkey (
        stripe_account_id,
        stripe_charges_enabled
      )
    )
  `)
  .eq('id', priceId)
  .single();

// CRITICAL CHECKS:
if (!sellerProfile?.stripe_account_id) {
  throw new Error("Seller has not connected their Stripe account yet");
}
if (!sellerProfile.stripe_charges_enabled) {
  throw new Error("Seller's Stripe account is not enabled for charges");
}
```

#### Step 3.3: Stripe Checkout Session Creation
**One-time payments**:
```typescript
const platformFeeAmount = Math.round(price.amount * 0.10 * 100); // 10% in cents

const session = await stripe.checkout.sessions.create({
  mode: 'payment',
  line_items: [{ price: price.stripe_price_id, quantity: 1 }],
  payment_intent_data: {
    application_fee_amount: platformFeeAmount, // Platform keeps this
    transfer_data: {
      destination: sellerProfile.stripe_account_id // Seller receives 90%
    }
  },
  metadata: {
    program_id, price_id, seller_id, user_id,
    tradingview_username
  }
});
```

**Subscriptions**:
```typescript
const session = await stripe.checkout.sessions.create({
  mode: 'subscription',
  line_items: [{ price: price.stripe_price_id, quantity: 1 }],
  subscription_data: {
    application_fee_percent: 10, // Platform keeps 10%
    transfer_data: {
      destination: sellerProfile.stripe_account_id // Seller receives 90%
    }
  }
});
```

#### Step 3.4: Payment Processing
1. Buyer completes payment on Stripe Checkout
2. **Money flow happens automatically**:
   - Platform account receives 10% fee
   - Seller's Stripe account receives 90%
   - No manual transfers needed
3. Stripe sends webhook event: `checkout.session.completed`

---

### 4. Post-Purchase Webhook Processing

#### Step 4.1: Webhook Received
**Endpoint**: `supabase/functions/stripe-webhook/index.ts`
**Event**: `checkout.session.completed`

```typescript
async function handleCheckoutCompleted(session: any, supabaseAdmin: any) {
  const { program_id, price_id, user_id, seller_id } = session.metadata;
  
  // Get price details
  const { data: price } = await supabaseAdmin
    .from('program_prices')
    .select('amount')
    .eq('id', priceId)
    .single();

  const amount = price?.amount || 0;
  const platformFee = amount * 0.10;
  const sellerOwed = amount - platformFee;

  // Create purchase record (for tracking only, money already transferred)
  await supabaseAdmin.from('purchases').insert({
    program_id, buyer_id: userId, seller_id,
    amount, platform_fee, seller_owed: sellerOwed,
    status: 'completed',
    payment_intent_id: session.payment_intent || session.id
  });

  // Create script assignment for TradingView access
  await supabaseAdmin.from('script_assignments').insert({
    program_id, buyer_id: userId,
    purchase_id: purchase.id,
    status: 'pending'
  });
}
```

**IMPORTANT**: 
- The webhook does NOT initiate payouts (money already transferred)
- It only creates database records for tracking
- `seller_balances` table is NOT used in Stripe Connect model

---

## Database Schema

### Key Tables

#### `profiles`
```sql
- stripe_account_id: text (Stripe Connect account ID)
- stripe_onboarding_completed: boolean
- stripe_charges_enabled: boolean (Required for selling)
- stripe_payouts_enabled: boolean
```

#### `purchases`
```sql
- id: uuid
- program_id: uuid → programs.id
- buyer_id: uuid → profiles.id
- seller_id: uuid → profiles.id
- amount: numeric (Total amount)
- platform_fee: numeric (10% of amount)
- seller_owed: numeric (90% of amount)
- status: text (completed, pending, failed)
- payment_intent_id: text (Stripe payment intent)
```

#### `program_prices`
```sql
- id: uuid
- program_id: uuid
- stripe_price_id: text (Stripe Price ID)
- amount: numeric
- price_type: text (one_time, recurring)
- interval: text (month, year) for recurring
```

---

## Security & Validation

### Pre-Publishing Checks
1. ✅ Seller must have `stripe_account_id`
2. ✅ Seller must have `stripe_charges_enabled = true`
3. ✅ UI blocks form submission if not connected
4. ✅ Backend validates Stripe status before program creation

### Pre-Purchase Checks
1. ✅ Seller's Stripe account exists
2. ✅ Seller's Stripe account is enabled for charges
3. ✅ Buyer has valid TradingView username
4. ✅ Program is published and active

### Rate Limiting
- Purchase endpoint: Rate limited per user/IP
- Security validation on all file uploads
- Input sanitization on all user content

---

## Seller Dashboard Access

### View Earnings
- Sellers access their Stripe Dashboard directly
- **Not** managed in PineMarket platform
- Button in `StripeConnectSettings` component

```typescript
const openStripeDashboard = async () => {
  const { data } = await supabase.functions.invoke('stripe-connect', {
    body: {
      action: 'create-dashboard-link',
      account_id: stripeStatus.account_id
    }
  });
  window.open(data.url, '_blank');
};
```

**Sellers can**:
- View all transactions
- Manage payouts (daily, weekly, monthly)
- Update bank account details
- View balance and pending payments
- Download tax documents

---

## Common Issues & Solutions

### Issue: Seller completes onboarding but charges_enabled still false
**Solution**: Stripe may take time to verify. Re-check status with:
```typescript
await checkAccountStatus(accountId);
```

### Issue: Purchase fails with "Seller not connected"
**Solution**: 
1. Check `stripe_account_id` exists in profiles
2. Check `stripe_charges_enabled = true`
3. Verify seller completed full onboarding

### Issue: Platform fee not being collected
**Solution**: 
- One-time: Verify `application_fee_amount` is set in payment_intent_data
- Subscription: Verify `application_fee_percent` is set in subscription_data

---

## Testing Checklist

### Seller Flow
- [ ] Create account
- [ ] Navigate to seller dashboard settings
- [ ] Click "Connect Stripe Account"
- [ ] Complete Stripe onboarding with test data
- [ ] Verify status shows "charges enabled"
- [ ] Attempt to publish program (should succeed)

### Publish Flow
- [ ] Visit /sell-script without Stripe (banner shows, form disabled)
- [ ] Visit /sell-script with Stripe (banner hidden, form enabled)
- [ ] Submit program (should succeed)
- [ ] Verify prices created with stripe_price_id

### Purchase Flow
- [ ] View program as buyer
- [ ] Click purchase
- [ ] Complete test payment on Stripe Checkout
- [ ] Verify purchase record created
- [ ] Verify script assignment created
- [ ] Check Stripe Dashboard for platform fee

### Edge Cases
- [ ] Try to publish without Stripe (should fail)
- [ ] Try to purchase from seller with disabled Stripe (should fail with error message)
- [ ] Test subscription cancellation
- [ ] Test trial period activation

---

## Environment Variables Required

```env
STRIPE_SECRET_KEY=sk_test_... (Platform account secret key)
STRIPE_WEBHOOK_SECRET=whsec_... (For webhook signature verification)
```

---

## Support & Maintenance

### Monitoring
- Check edge function logs regularly
- Monitor Stripe Dashboard for failed transfers
- Review security audit logs for suspicious activity

### Seller Support
- Direct sellers to Stripe Dashboard for payout issues
- Platform only handles connection status, not payout management
- Stripe handles all KYC, verification, and compliance

---

## Migration Notes

### Previous System (Seller Balances)
- Used `seller_balances` table
- Platform held funds for 7 days
- Manual payout processing via `process-payouts`

### Current System (Stripe Connect)
- Direct transfers to seller Stripe accounts
- Instant availability (Stripe manages payout schedule)
- No manual payout processing
- Sellers manage their own payouts via Stripe Dashboard

### Tables No Longer Used
- `seller_balances` (sellers manage via Stripe)
- `seller_payout_info` (handled by Stripe)
- `payouts` (managed by Stripe)

---

## Next Steps / Future Enhancements

1. **Webhook for account updates**: Listen to Stripe Connect account.updated events
2. **Automated status refresh**: Periodic checks for seller account status
3. **Dashboard metrics**: Show aggregated earnings data from Stripe API
4. **Refund handling**: Implement refund webhook processing
5. **Dispute management**: Handle Stripe dispute events

---

## References

- [Stripe Connect Documentation](https://stripe.com/docs/connect)
- [Destination Charges](https://stripe.com/docs/connect/destination-charges)
- [Express Accounts](https://stripe.com/docs/connect/express-accounts)
- [Webhooks Guide](https://stripe.com/docs/webhooks)
