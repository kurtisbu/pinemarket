
# Admin Featured Creators with Custom Fee Management

## Overview
This plan enhances the existing featured creators system to allow platform admins to set custom platform fee rates for individual creators. Featured creators can receive reduced fees as a promotional benefit.

## Current State Analysis
- Featured creator functionality already exists with `is_featured`, `featured_priority`, and `featured_description` on the `profiles` table
- Platform fee is hardcoded at 10% in edge functions
- No per-creator fee customization exists

## Implementation Plan

### Phase 1: Database Schema Updates

**Add custom fee column to profiles table:**
```sql
ALTER TABLE public.profiles 
ADD COLUMN custom_platform_fee_percent numeric 
  DEFAULT NULL 
  CHECK (custom_platform_fee_percent IS NULL OR 
         (custom_platform_fee_percent >= 0 AND custom_platform_fee_percent <= 100));

COMMENT ON COLUMN public.profiles.custom_platform_fee_percent IS 
  'Custom platform fee percentage for featured creators. NULL means use default (10%).';
```

**Create a helper function to get effective fee rate:**
```sql
CREATE OR REPLACE FUNCTION public.get_seller_fee_rate(seller_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT custom_platform_fee_percent FROM profiles WHERE id = seller_id),
    10.0  -- Default 10% platform fee
  );
$$;
```

**Update toggle_creator_featured_status to accept fee parameter:**
```sql
CREATE OR REPLACE FUNCTION public.toggle_creator_featured_status(
  creator_id uuid, 
  featured boolean, 
  priority integer DEFAULT 0, 
  description text DEFAULT NULL,
  custom_fee_percent numeric DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Access denied: Admin role required';
  END IF;
  
  UPDATE public.profiles
  SET 
    is_featured = featured,
    featured_at = CASE WHEN featured THEN now() ELSE NULL END,
    featured_priority = CASE WHEN featured THEN priority ELSE 0 END,
    featured_description = CASE WHEN featured THEN description ELSE NULL END,
    custom_platform_fee_percent = CASE WHEN featured THEN custom_fee_percent ELSE NULL END
  WHERE id = creator_id;
  
  PERFORM public.log_security_event(
    'toggle_creator_featured_status',
    'profile',
    creator_id::text,
    jsonb_build_object(
      'featured', featured,
      'priority', priority,
      'description', description,
      'custom_fee_percent', custom_fee_percent
    ),
    'low'
  );
END;
$$;
```

### Phase 2: Edge Function Updates

**Update `supabase/functions/create-checkout/index.ts`:**
- Query the seller's `custom_platform_fee_percent` from profiles
- Calculate fee using custom rate if set, otherwise use default 10%
- Pass the fee rate to Stripe checkout session

**Update `supabase/functions/stripe-webhook/index.ts`:**
- Query the seller's fee rate using the new `get_seller_fee_rate` function
- Calculate `platformFee` and `sellerOwed` using the dynamic rate
- Store the actual fee percentage in purchase record for audit

### Phase 3: Admin UI Enhancements

**Update `src/components/AdminFeaturedCreators.tsx`:**
1. Add a fee percentage input to the `FeaturedCreatorForm`
2. Display current fee rate for each creator
3. Show "Custom Fee" badge when a creator has reduced fees
4. Pass the custom fee to the updated RPC function

**UI Additions:**
- Slider or input for fee percentage (0-10% for discounts)
- Display showing "Standard 10%" or "Custom X%" per creator
- Clear indication of potential revenue impact

### Phase 4: Seller Dashboard Visibility

**Update seller-facing components to show their fee rate:**
- Display current fee rate on `SellerDashboard.tsx`
- Show savings from featured status in `SellerPayoutSettings.tsx`

---

## Technical Details

### Database Migration
```text
+--------------------------------------+
|           profiles                   |
+--------------------------------------+
| + custom_platform_fee_percent        |
|   (numeric, nullable, 0-100 check)   |
+--------------------------------------+
```

### Fee Calculation Flow
```text
Purchase Request
      |
      v
+------------------+
| Fetch Seller's   |
| custom_fee_rate  |
+------------------+
      |
      v
+------------------+
| Fee = custom OR  |
| default (10%)    |
+------------------+
      |
      v
+------------------+
| Calculate:       |
| platformFee      |
| sellerOwed       |
+------------------+
      |
      v
+------------------+
| Stripe Checkout  |
| with dynamic fee |
+------------------+
```

### Security Considerations
- Only admins can modify `custom_platform_fee_percent`
- RLS policies prevent creators from self-modifying their fee rate
- All fee changes are logged via `log_security_event`
- The `get_seller_fee_rate` function is SECURITY DEFINER to prevent unauthorized access

### Files to Modify

| File | Changes |
|------|---------|
| Database migration | Add `custom_platform_fee_percent` column, update functions |
| `supabase/functions/create-checkout/index.ts` | Dynamic fee calculation |
| `supabase/functions/stripe-webhook/index.ts` | Dynamic fee calculation |
| `src/components/AdminFeaturedCreators.tsx` | Add fee input to featured form |
| `src/integrations/supabase/types.ts` | Auto-updated from schema |

### Default Behavior
- **Standard creators**: 10% platform fee
- **Featured creators**: Can have 0-10% custom fee (set by admin)
- **NULL custom_fee**: Falls back to default 10%
