import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeSecretKey) {
      throw new Error('STRIPE_SECRET_KEY not configured');
    }

    console.log('[PROCESS-PAYOUTS] Starting payout processing...');

    // Get all sellers with available balance > minimum payout threshold ($50)
    const MINIMUM_PAYOUT = 50;
    
    const { data: sellers, error: sellersError } = await supabaseClient
      .from('seller_balances')
      .select(`
        seller_id,
        available_balance,
        profiles!seller_balances_seller_id_fkey (
          id,
          display_name,
          stripe_account_id,
          stripe_payouts_enabled
        ),
        seller_payout_info!seller_payout_info_user_id_fkey (
          payout_method,
          bank_account_holder_name,
          bank_account_number,
          bank_routing_number,
          paypal_email,
          is_verified,
          currency
        )
      `)
      .gte('available_balance', MINIMUM_PAYOUT);

    if (sellersError) {
      console.error('[PROCESS-PAYOUTS] Error fetching sellers:', sellersError);
      throw sellersError;
    }

    if (!sellers || sellers.length === 0) {
      console.log('[PROCESS-PAYOUTS] No sellers eligible for payout');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No sellers eligible for payout',
          processed: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[PROCESS-PAYOUTS] Found ${sellers.length} sellers eligible for payout`);

    const results = [];
    
    for (const seller of sellers) {
      const sellerProfile = Array.isArray(seller.profiles) 
        ? seller.profiles[0] 
        : seller.profiles;

      const sellerInfo = Array.isArray(seller.seller_payout_info) 
        ? seller.seller_payout_info[0] 
        : seller.seller_payout_info;

      // Check for Stripe Connect account
      if (sellerProfile?.stripe_account_id && sellerProfile?.stripe_payouts_enabled) {
        // Use Stripe Connect Transfer
        console.log(`[PROCESS-PAYOUTS] Seller ${seller.seller_id} has Stripe Connect enabled`);
      } else if (!sellerInfo || !sellerInfo.is_verified) {
        console.log(`[PROCESS-PAYOUTS] Skipping seller ${seller.seller_id} - no valid payout method`);
        results.push({
          seller_id: seller.seller_id,
          success: false,
          error: 'No verified payout method configured'
        });
        continue;
      }

      try {
        console.log(`[PROCESS-PAYOUTS] Processing payout for seller ${seller.seller_id}, amount: $${seller.available_balance}`);

        // Create payout record
        const payoutMethod = sellerProfile?.stripe_account_id ? 'bank_transfer' : (sellerInfo?.payout_method || 'bank_transfer');
        
        const { data: payout, error: payoutError } = await supabaseClient
          .from('payouts')
          .insert({
            seller_id: seller.seller_id,
            amount: seller.available_balance,
            status: 'processing',
            payout_method: payoutMethod
          })
          .select()
          .single();

        if (payoutError) {
          console.error(`[PROCESS-PAYOUTS] Error creating payout record:`, payoutError);
          throw payoutError;
        }

        // Initialize Stripe
        const Stripe = (await import('https://esm.sh/stripe@14.21.0')).default;
        const stripe = new Stripe(stripeSecretKey, {
          apiVersion: '2023-10-16',
        });

        const payoutAmount = Math.round(seller.available_balance * 100); // Convert to cents

        // Option 1: Stripe Connect Transfer (preferred if seller has connected account)
        if (sellerProfile?.stripe_account_id && sellerProfile?.stripe_payouts_enabled) {
          try {
            console.log(`[PROCESS-PAYOUTS] Creating Stripe Connect Transfer for seller ${seller.seller_id}`);
            
            const transfer = await stripe.transfers.create({
              amount: payoutAmount,
              currency: sellerInfo?.currency?.toLowerCase() || 'usd',
              destination: sellerProfile.stripe_account_id,
              description: `Payout for seller ${seller.seller_id}`,
              metadata: {
                seller_id: seller.seller_id,
                payout_record_id: payout.id,
              },
            });

            console.log(`[PROCESS-PAYOUTS] Stripe transfer created: ${transfer.id}`);
            
            // Update payout record
            await supabaseClient
              .from('payouts')
              .update({
                status: 'completed',
                completed_at: new Date().toISOString(),
                stripe_transfer_id: transfer.id
              })
              .eq('id', payout.id);

            // Update seller balance
            await supabaseClient.rpc('update_seller_balance', {
              p_seller_id: seller.seller_id,
              p_amount: seller.available_balance,
              p_type: 'payout'
            });

            results.push({
              seller_id: seller.seller_id,
              success: true,
              amount: seller.available_balance,
              transfer_id: transfer.id
            });

          } catch (stripeError: any) {
            console.error(`[PROCESS-PAYOUTS] Stripe transfer error for seller ${seller.seller_id}:`, stripeError);
            
            await supabaseClient
              .from('payouts')
              .update({
                status: 'failed',
                failure_reason: stripeError.message || 'Stripe transfer failed'
              })
              .eq('id', payout.id);

            results.push({
              seller_id: seller.seller_id,
              success: false,
              error: stripeError.message
            });
          }

        // Option 2: Direct bank transfer (requires manual bank verification)
        } else if (sellerInfo?.payout_method === 'bank_transfer') {
          console.log(`[PROCESS-PAYOUTS] Bank transfer not yet implemented - seller needs to connect Stripe account`);
          
          await supabaseClient
            .from('payouts')
            .update({
              status: 'failed',
              failure_reason: 'Please connect your Stripe account to receive payouts'
            })
            .eq('id', payout.id);

          results.push({
            seller_id: seller.seller_id,
            success: false,
            error: 'Stripe Connect required for payouts'
          });

        } else if (sellerInfo?.payout_method === 'paypal') {
          // For PayPal, you would integrate with PayPal's Payouts API
          console.log(`[PROCESS-PAYOUTS] PayPal payouts not yet implemented for seller ${seller.seller_id}`);
          
          await supabaseClient
            .from('payouts')
            .update({
              status: 'failed',
              failure_reason: 'PayPal integration not yet implemented'
            })
            .eq('id', payout.id);

          results.push({
            seller_id: seller.seller_id,
            success: false,
            error: 'PayPal integration not yet implemented'
          });
        }

      } catch (error) {
        console.error(`[PROCESS-PAYOUTS] Error processing payout for seller ${seller.seller_id}:`, error);
        results.push({
          seller_id: seller.seller_id,
          success: false,
          error: error.message
        });
      }
    }

    console.log('[PROCESS-PAYOUTS] Payout processing complete');

    return new Response(
      JSON.stringify({ 
        success: true,
        processed: results.length,
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[PROCESS-PAYOUTS] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});