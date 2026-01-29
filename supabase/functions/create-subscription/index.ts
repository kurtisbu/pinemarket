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
    const { programId, billingInterval = 'month', successUrl, cancelUrl } = await req.json();

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;

    if (!user?.email) {
      throw new Error("User not authenticated");
    }

    // Get program subscription details
    const { data: program, error: programError } = await supabaseClient
      .from('programs')
      .select('*')
      .eq('id', programId)
      .eq('pricing_model', 'subscription')
      .single();

    if (programError || !program) {
      throw new Error("Program not found or not subscription-based");
    }

    // Validate billing interval and get price
    let price: number;
    let stripeInterval: string;
    let stripePriceId: string | null = null;

    if (billingInterval === 'month') {
      if (!program.monthly_price) {
        throw new Error("Monthly pricing not available for this program");
      }
      price = program.monthly_price;
      stripeInterval = 'month';
      stripePriceId = program.stripe_monthly_price_id;
    } else if (billingInterval === 'year') {
      if (!program.yearly_price) {
        throw new Error("Yearly pricing not available for this program");
      }
      price = program.yearly_price;
      stripeInterval = 'year';
      stripePriceId = program.stripe_yearly_price_id;
    } else {
      throw new Error("Invalid billing interval");
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2023-10-16",
    });

    // Find or create customer
    let customerId: string;
    const customers = await stripe.customers.list({
      email: user.email,
      limit: 1,
    });

    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    } else {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          user_id: user.id,
        },
      });
      customerId = customer.id;
    }

    // Create or get Stripe product if it doesn't exist
    let productId = program.stripe_product_id;
    if (!productId) {
      const product = await stripe.products.create({
        name: `${program.title} - Subscription`,
        description: program.description,
        metadata: {
          program_id: program.id,
          seller_id: program.seller_id,
        },
      });
      productId = product.id;

      // Update program with product ID
      await supabaseClient
        .from('programs')
        .update({ stripe_product_id: productId })
        .eq('id', program.id);
    }

    // Create or get Stripe price if it doesn't exist
    if (!stripePriceId) {
      const stripePrice = await stripe.prices.create({
        product: productId,
        currency: 'usd',
        unit_amount: Math.round(price * 100), // Convert to cents
        recurring: {
          interval: stripeInterval,
        },
        metadata: {
          program_id: program.id,
          billing_interval: billingInterval,
        },
      });
      
      stripePriceId = stripePrice.id;

      // Update program with price ID
      const updateData = billingInterval === 'month' 
        ? { stripe_monthly_price_id: stripePriceId }
        : { stripe_yearly_price_id: stripePriceId };

      await supabaseClient
        .from('programs')
        .update(updateData)
        .eq('id', program.id);
    }

    // Create checkout session
    const sessionData: any = {
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: stripePriceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        program_id: program.id,
        seller_id: program.seller_id,
        user_id: user.id,
        billing_interval: billingInterval,
      },
    };

    // Add trial period if configured
    if (program.trial_period_days && program.trial_period_days > 0) {
      sessionData.subscription_data = {
        trial_period_days: program.trial_period_days,
      };
    }

    const session = await stripe.checkout.sessions.create(sessionData);

    return new Response(
      JSON.stringify({ url: session.url }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Subscription creation error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});