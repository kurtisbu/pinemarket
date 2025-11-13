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
    const { programId, packageId, resourceType, resourceId, prices } = await req.json();

    // Support both old API (programId) and new API (resourceType/resourceId)
    const finalResourceType = resourceType || (programId ? 'program' : packageId ? 'package' : null);
    const finalResourceId = resourceId || programId || packageId;

    if (!finalResourceType || !finalResourceId) {
      throw new Error("Resource type and ID are required");
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    console.log(`[CREATE-PRICES] Creating Stripe products for ${finalResourceType}: ${finalResourceId}`);

    // Get resource details
    let resource: any;
    let pricesData: any[];
    
    if (finalResourceType === 'package') {
      const { data: packageData, error: packageError } = await supabaseAdmin
        .from('program_packages')
        .select('*')
        .eq('id', finalResourceId)
        .single();

      if (packageError || !packageData) {
        throw new Error("Package not found");
      }
      resource = packageData;

      if (prices) {
        // Prices provided in request (for package creation)
        pricesData = prices.map((p: any, index: number) => ({
          ...p,
          id: crypto.randomUUID(),
          sort_order: index,
        }));
      } else {
        // Fetch existing prices from database
        const { data: existingPrices, error: pricesError } = await supabaseAdmin
          .from('package_prices')
          .select('*')
          .eq('package_id', finalResourceId)
          .eq('is_active', true)
          .order('sort_order');

        if (pricesError || !existingPrices || existingPrices.length === 0) {
          throw new Error("No active prices found for this package");
        }
        pricesData = existingPrices;
      }
    } else {
      const { data: programData, error: programError } = await supabaseAdmin
        .from('programs')
        .select('*')
        .eq('id', finalResourceId)
        .single();

      if (programError || !programData) {
        throw new Error("Program not found");
      }
      resource = programData;

      // Get all price objects for this program
      const { data: existingPrices, error: pricesError } = await supabaseAdmin
        .from('program_prices')
        .select('*')
        .eq('program_id', finalResourceId)
        .eq('is_active', true)
        .order('sort_order');

      if (pricesError || !existingPrices || existingPrices.length === 0) {
        throw new Error("No active prices found for this program");
      }
      pricesData = existingPrices;
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2023-10-16",
    });

    // Create Stripe product for the resource
    const stripeProduct = await stripe.products.create({
      name: resource.title,
      description: resource.description || undefined,
      metadata: {
        [finalResourceType === 'package' ? 'package_id' : 'program_id']: resource.id,
        seller_id: resource.seller_id,
        resource_type: finalResourceType,
      },
    });

    console.log(`[CREATE-PRICES] Created Stripe product: ${stripeProduct.id}`);

    // Create Stripe prices for each price object
    const createdPrices = [];
    for (const price of pricesData) {
      const stripePriceData: any = {
        product: stripeProduct.id,
        currency: price.currency || 'usd',
        unit_amount: Math.round(price.amount * 100), // Convert to cents
        nickname: price.display_name,
        metadata: {
          [finalResourceType === 'package' ? 'package_id' : 'program_id']: resource.id,
          price_id: price.id,
          price_type: price.price_type,
          resource_type: finalResourceType,
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

      createdPrices.push({
        ...price,
        stripe_price_id: stripePrice.id,
      });
    }

    console.log(`[CREATE-PRICES] Successfully created ${pricesData.length} Stripe prices`);

    return new Response(
      JSON.stringify({ 
        success: true,
        product_id: stripeProduct.id,
        prices_created: pricesData.length,
        prices: createdPrices,
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
