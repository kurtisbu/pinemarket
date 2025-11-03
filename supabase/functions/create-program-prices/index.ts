import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { programId } = await req.json();

    if (!programId) {
      throw new Error("Program ID is required");
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    console.log(`[CREATE-PRICES] Creating Stripe products for program: ${programId}`);

    // Get program details
    const { data: program, error: programError } = await supabaseAdmin
      .from('programs')
      .select('*')
      .eq('id', programId)
      .single();

    if (programError || !program) {
      throw new Error("Program not found");
    }

    // Get all price objects for this program
    const { data: prices, error: pricesError } = await supabaseAdmin
      .from('program_prices')
      .select('*')
      .eq('program_id', programId)
      .eq('is_active', true)
      .order('sort_order');

    if (pricesError || !prices || prices.length === 0) {
      throw new Error("No active prices found for this program");
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2023-10-16",
    });

    // Create Stripe product for the program
    const stripeProduct = await stripe.products.create({
      name: program.title,
      description: program.description || undefined,
      metadata: {
        program_id: program.id,
        seller_id: program.seller_id,
      },
    });

    console.log(`[CREATE-PRICES] Created Stripe product: ${stripeProduct.id}`);

    // Create Stripe prices for each price object
    const priceUpdates = [];
    for (const price of prices) {
      const stripePriceData: any = {
        product: stripeProduct.id,
        currency: price.currency || 'usd',
        unit_amount: Math.round(price.amount * 100), // Convert to cents
        nickname: price.display_name,
        metadata: {
          program_id: program.id,
          price_id: price.id,
          price_type: price.price_type,
        },
      };

      // Add recurring interval if it's a recurring price
      if (price.price_type === 'recurring' && price.interval) {
        // Map our intervals to Stripe intervals
        let stripeInterval: 'month' | 'year' = 'month';
        let intervalCount = 1;

        if (price.interval === 'month') {
          stripeInterval = 'month';
          intervalCount = 1;
        } else if (price.interval === '3_months') {
          stripeInterval = 'month';
          intervalCount = 3;
        } else if (price.interval === 'year') {
          stripeInterval = 'year';
          intervalCount = 1;
        }

        stripePriceData.recurring = {
          interval: stripeInterval,
          interval_count: intervalCount,
        };
      }

      const stripePrice = await stripe.prices.create(stripePriceData);
      
      console.log(`[CREATE-PRICES] Created Stripe price: ${stripePrice.id} for ${price.display_name}`);

      // Update program_prices with Stripe price ID
      priceUpdates.push(
        supabaseAdmin
          .from('program_prices')
          .update({ stripe_price_id: stripePrice.id })
          .eq('id', price.id)
      );
    }

    // Execute all price updates
    await Promise.all(priceUpdates);

    console.log(`[CREATE-PRICES] Successfully created ${prices.length} Stripe prices`);

    return new Response(
      JSON.stringify({ 
        success: true,
        product_id: stripeProduct.id,
        prices_created: prices.length,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("[CREATE-PRICES] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
