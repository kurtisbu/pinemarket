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

    console.log('[SETTLE-BALANCES] Starting balance settlement...');

    // Find all purchases that are completed and older than 7 days (clearance period)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: completedPurchases, error: purchasesError } = await supabaseClient
      .from('purchases')
      .select('seller_id, seller_owed, updated_at')
      .eq('status', 'completed')
      .lt('updated_at', sevenDaysAgo.toISOString());

    if (purchasesError) {
      console.error('[SETTLE-BALANCES] Error fetching purchases:', purchasesError);
      throw purchasesError;
    }

    if (!completedPurchases || completedPurchases.length === 0) {
      console.log('[SETTLE-BALANCES] No purchases ready for settlement');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No purchases ready for settlement',
          settled: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[SETTLE-BALANCES] Found ${completedPurchases.length} purchases ready for settlement`);

    // Group by seller_id and sum amounts
    const sellerAmounts = new Map();
    for (const purchase of completedPurchases) {
      const current = sellerAmounts.get(purchase.seller_id) || 0;
      sellerAmounts.set(purchase.seller_id, current + Number(purchase.seller_owed));
    }

    // Settle balances for each seller
    for (const [sellerId, amount] of sellerAmounts) {
      console.log(`[SETTLE-BALANCES] Settling balance for seller ${sellerId}: $${amount}`);
      
      const { error: settleError } = await supabaseClient
        .rpc('settle_pending_balance', {
          p_seller_id: sellerId
        });

      if (settleError) {
        console.error(`[SETTLE-BALANCES] Error settling balance for seller ${sellerId}:`, settleError);
      }
    }

    console.log('[SETTLE-BALANCES] Balance settlement complete');

    return new Response(
      JSON.stringify({ 
        success: true,
        settled: sellerAmounts.size,
        totalAmount: Array.from(sellerAmounts.values()).reduce((a, b) => a + b, 0)
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[SETTLE-BALANCES] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});