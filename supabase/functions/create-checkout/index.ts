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
    const { priceId, packagePriceId, successUrl, cancelUrl } = await req.json();

    if (!priceId && !packagePriceId) {
      throw new Error("Price ID or Package Price ID is required");
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

    // Fetch buyer's TradingView username from profile
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('tradingview_username')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.tradingview_username) {
      throw new Error("TradingView username not found. Please add your TradingView username to your profile before purchasing.");
    }

    let price: any;
    let isPackage = false;
    let packageId: string | null = null;

    if (packagePriceId) {
      // Handle package purchase
      console.log(`[CHECKOUT] Creating checkout session for package price: ${packagePriceId}`);
      
      const { data: packagePrice, error: packagePriceError } = await supabaseClient
        .from('package_prices')
        .select(`
          *,
          program_packages (
            id,
            title,
            seller_id,
            profiles!program_packages_seller_id_fkey (
              stripe_account_id,
              stripe_charges_enabled
            )
          )
        `)
        .eq('id', packagePriceId)
        .single();

      if (packagePriceError || !packagePrice) {
        throw new Error("Package price not found");
      }

      if (!packagePrice.stripe_price_id) {
        throw new Error("Stripe price not configured for this package");
      }

      const sellerProfile = packagePrice.program_packages.profiles;
      if (!sellerProfile?.stripe_account_id) {
        throw new Error("Seller has not connected their Stripe account yet");
      }

      if (!sellerProfile.stripe_charges_enabled) {
        throw new Error("Seller's Stripe account is not enabled for charges");
      }

      price = packagePrice;
      isPackage = true;
      packageId = packagePrice.program_packages.id;
    } else {
      // Handle single program purchase
      console.log(`[CHECKOUT] Creating checkout session for program price: ${priceId}`);
      
      const { data: programPrice, error: priceError } = await supabaseClient
        .from('program_prices')
        .select(`
          *,
          programs (
            id,
            title,
            seller_id,
            trial_period_days,
            profiles!programs_seller_id_fkey (
              stripe_account_id,
              stripe_charges_enabled
            )
          )
        `)
        .eq('id', priceId)
        .single();

      if (priceError || !programPrice) {
        throw new Error("Price not found");
      }

      if (!programPrice.stripe_price_id) {
        throw new Error("Stripe price not configured for this pricing option");
      }

      const sellerProfile = programPrice.programs.profiles;
      if (!sellerProfile?.stripe_account_id) {
        throw new Error("Seller has not connected their Stripe account yet");
      }

      if (!sellerProfile.stripe_charges_enabled) {
        throw new Error("Seller's Stripe account is not enabled for charges");
      }

      price = programPrice;
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

    // Calculate platform fee (10%)
    const platformFeeAmount = Math.round(price.amount * 0.10 * 100); // Convert to cents
    
    const sellerId = isPackage ? price.program_packages.seller_id : price.programs.seller_id;
    const sellerProfile = isPackage ? price.program_packages.profiles : price.programs.profiles;
    const resourceId = isPackage ? packageId : price.programs.id;
    const resourceType = isPackage ? 'package' : 'program';

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
        [resourceType === 'package' ? 'package_id' : 'program_id']: resourceId,
        price_id: price.id,
        seller_id: sellerId,
        user_id: user.id,
        price_type: price.price_type,
        tradingview_username: profile.tradingview_username,
        is_package: isPackage.toString(),
      },
    };

    // Add destination charges for Stripe Connect (platform takes 10% fee)
    if (mode === 'payment') {
      sessionData.payment_intent_data = {
        application_fee_amount: platformFeeAmount,
        transfer_data: {
          destination: sellerProfile.stripe_account_id,
        },
      };
    } else {
      // For subscriptions, use application_fee_percent
      sessionData.subscription_data = {
        application_fee_percent: 10,
        transfer_data: {
          destination: sellerProfile.stripe_account_id,
        },
      };
      
      // Add trial period if configured (only for single programs)
      if (!isPackage && price.programs.trial_period_days && price.programs.trial_period_days > 0) {
        sessionData.subscription_data.trial_period_days = price.programs.trial_period_days;
      }
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
