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
    const { priceId, successUrl, cancelUrl } = await req.json();

    if (!priceId) {
      throw new Error("Price ID is required");
    }

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

    console.log(`[CHECKOUT] Creating checkout session for price: ${priceId}`);

    // Fetch buyer's TradingView username from profile
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('tradingview_username')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.tradingview_username) {
      throw new Error("TradingView username not found. Please add your TradingView username to your profile before purchasing.");
    }

    // Get price details
    const { data: price, error: priceError } = await supabaseClient
      .from('program_prices')
      .select(`
        *,
        programs (
          id,
          title,
          seller_id,
          trial_period_days
        )
      `)
      .eq('id', priceId)
      .single();

    if (priceError || !price) {
      throw new Error("Price not found");
    }

    if (!price.stripe_price_id) {
      throw new Error("Stripe price not configured for this pricing option");
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

    // Determine checkout mode based on price type
    const mode = price.price_type === 'recurring' ? 'subscription' : 'payment';

    // Create checkout session
    const sessionData: any = {
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: price.stripe_price_id,
          quantity: 1,
        },
      ],
      mode: mode,
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        program_id: price.programs.id,
        price_id: price.id,
        seller_id: price.programs.seller_id,
        user_id: user.id,
        price_type: price.price_type,
        tradingview_username: profile.tradingview_username,
      },
    };

    // Add trial period if configured and it's a subscription
    if (mode === 'subscription' && price.programs.trial_period_days && price.programs.trial_period_days > 0) {
      sessionData.subscription_data = {
        trial_period_days: price.programs.trial_period_days,
      };
    }

    const session = await stripe.checkout.sessions.create(sessionData);

    console.log(`[CHECKOUT] Created session: ${session.id}`);

    return new Response(
      JSON.stringify({ url: session.url, sessionId: session.id }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("[CHECKOUT] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
