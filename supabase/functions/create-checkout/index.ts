import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  ensureStripePriceForPackagePrice,
  ensureStripePriceForProgramPrice,
  ensureBuyerInclusivePriceForProgramPrice,
  ensureBuyerInclusivePriceForPackagePrice,
  calculateBuyerInclusiveAmount,
  BUYER_FEE_PERCENT,
} from "./stripeEnsure.ts";

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

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;

    if (!user?.email) {
      throw new Error("User not authenticated");
    }

    // Fetch buyer's TradingView username from profile using admin client to bypass RLS
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('tradingview_username')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error("[CHECKOUT] Profile fetch error:", profileError);
      throw new Error("Could not fetch profile. Please try again.");
    }

    if (!profile?.tradingview_username) {
      throw new Error("TradingView username not found. Please add your TradingView username to your profile before purchasing.");
    }

    let price: any;
    let isPackage = false;
    let packageId: string | null = null;
    let sellerId: string;
    let sellerProfile: any;

    if (packagePriceId) {
      // Handle package purchase
      console.log(`[CHECKOUT] Creating checkout session for package price: ${packagePriceId}`);
      
      const { data: packagePrice, error: packagePriceError } = await supabaseAdmin
        .from('package_prices')
        .select(`
          *,
          program_packages (
            id,
            title,
            description,
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
        // Auto-heal: create Stripe product+price and persist stripe_price_id
        const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
          apiVersion: "2023-10-16",
        });

        packagePrice.stripe_price_id = await ensureStripePriceForPackagePrice(stripe, supabaseAdmin, {
          id: packagePrice.id,
          price_type: packagePrice.price_type,
          amount: packagePrice.amount,
          currency: packagePrice.currency,
          interval: packagePrice.interval,
          display_name: packagePrice.display_name,
          stripe_price_id: packagePrice.stripe_price_id,
          program_packages: {
            id: packagePrice.program_packages.id,
            title: packagePrice.program_packages.title,
            description: packagePrice.program_packages.description ?? null,
            seller_id: packagePrice.program_packages.seller_id,
          },
        });
      }

      sellerProfile = packagePrice.program_packages.profiles;
      if (!sellerProfile?.stripe_account_id) {
        throw new Error("Seller has not connected their Stripe account yet");
      }

      if (!sellerProfile.stripe_charges_enabled) {
        throw new Error("Seller's Stripe account is not enabled for charges");
      }

      price = packagePrice;
      isPackage = true;
      packageId = packagePrice.program_packages.id;
      sellerId = packagePrice.program_packages.seller_id;
    } else {
      // Handle single program purchase
      console.log(`[CHECKOUT] Creating checkout session for program price: ${priceId}`);
      
      const { data: programPrice, error: priceError } = await supabaseAdmin
        .from('program_prices')
        .select(`
          *,
          programs (
            id,
            title,
            description,
            seller_id,
            stripe_product_id,
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
        // Auto-heal: create Stripe product+price and persist stripe IDs
        const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
          apiVersion: "2023-10-16",
        });

        programPrice.stripe_price_id = await ensureStripePriceForProgramPrice(stripe, supabaseAdmin, {
          id: programPrice.id,
          price_type: programPrice.price_type,
          amount: programPrice.amount,
          currency: programPrice.currency,
          interval: programPrice.interval,
          display_name: programPrice.display_name,
          stripe_price_id: programPrice.stripe_price_id,
          programs: {
            id: programPrice.programs.id,
            title: programPrice.programs.title,
            description: (programPrice.programs as any).description ?? null,
            seller_id: programPrice.programs.seller_id,
            stripe_product_id: (programPrice.programs as any).stripe_product_id ?? null,
          },
        });
      }

      sellerProfile = programPrice.programs.profiles;
      if (!sellerProfile?.stripe_account_id) {
        throw new Error("Seller has not connected their Stripe account yet");
      }

      if (!sellerProfile.stripe_charges_enabled) {
        throw new Error("Seller's Stripe account is not enabled for charges");
      }

      price = programPrice;
      sellerId = programPrice.programs.seller_id;
    }

    // Get seller's custom fee rate using the database function
    const { data: feeRateResult, error: feeRateError } = await supabaseAdmin
      .rpc('get_seller_fee_rate', { seller_id: sellerId });

    const sellerFeePercent = feeRateError ? 5.0 : (feeRateResult ?? 5.0);
    const buyerFeePercent = BUYER_FEE_PERCENT;
    console.log(`[CHECKOUT] Fee rates - seller: ${sellerFeePercent}%, buyer: ${buyerFeePercent}%`);

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2023-10-16",
    });

    // Resolve the buyer-inclusive Stripe price (list price + buyer fee)
    let buyerInclusivePriceId: string;
    if (isPackage) {
      buyerInclusivePriceId = await ensureBuyerInclusivePriceForPackagePrice(stripe, supabaseAdmin, {
        id: price.id,
        price_type: price.price_type,
        amount: price.amount,
        currency: price.currency,
        interval: price.interval,
        display_name: price.display_name,
        stripe_price_id: price.stripe_price_id,
        stripe_buyer_inclusive_price_id: price.stripe_buyer_inclusive_price_id ?? null,
        program_packages: {
          id: price.program_packages.id,
          title: price.program_packages.title,
          description: price.program_packages.description ?? null,
          seller_id: price.program_packages.seller_id,
        },
      });
    } else {
      buyerInclusivePriceId = await ensureBuyerInclusivePriceForProgramPrice(stripe, supabaseAdmin, {
        id: price.id,
        price_type: price.price_type,
        amount: price.amount,
        currency: price.currency,
        interval: price.interval,
        display_name: price.display_name,
        stripe_buyer_inclusive_price_id: price.stripe_buyer_inclusive_price_id ?? null,
        programs: {
          id: price.programs.id,
          title: price.programs.title,
          description: (price.programs as any).description ?? null,
          seller_id: price.programs.seller_id,
          stripe_product_id: (price.programs as any).stripe_product_id ?? null,
        },
      });
    }

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

    // Fee math (Fiverr-style split):
    //   listAmount  = price.amount                           ($100)
    //   buyerFee    = listAmount * buyerFeePercent / 100     ($5)
    //   totalCharged= listAmount + buyerFee                  ($105)
    //   sellerFee   = listAmount * sellerFeePercent / 100    ($5)
    //   platformTake= buyerFee + sellerFee                   ($10) -> application_fee
    //   sellerNet   = listAmount - sellerFee                 ($95)
    const listAmount = price.amount;
    const buyerFeeAmount = Math.round(listAmount * (buyerFeePercent / 100) * 100) / 100;
    const totalCharged = Math.round((listAmount + buyerFeeAmount) * 100) / 100;
    const sellerFeeAmount = Math.round(listAmount * (sellerFeePercent / 100) * 100) / 100;
    const applicationFeeAmountCents = Math.round((buyerFeeAmount + sellerFeeAmount) * 100);
    const applicationFeePercent = totalCharged > 0
      ? Math.round(((buyerFeeAmount + sellerFeeAmount) / totalCharged) * 10000) / 100
      : 0;

    const resourceId = isPackage ? packageId : price.programs.id;
    const resourceType = isPackage ? 'package' : 'program';

    // Create checkout session
    const sessionData: any = {
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: buyerInclusivePriceId,
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
        fee_percent: sellerFeePercent.toString(),
        seller_fee_percent: sellerFeePercent.toString(),
        buyer_fee_percent: buyerFeePercent.toString(),
        list_amount: listAmount.toString(),
        total_charged: totalCharged.toString(),
      },
    };

    // Add destination charges for Stripe Connect (platform takes dynamic fee)
    if (mode === 'payment') {
      sessionData.payment_intent_data = {
        application_fee_amount: applicationFeeAmountCents,
        transfer_data: {
          destination: sellerProfile.stripe_account_id,
        },
      };
    } else {
      // For subscriptions, use application_fee_percent
      sessionData.subscription_data = {
        application_fee_percent: applicationFeePercent,
        transfer_data: {
          destination: sellerProfile.stripe_account_id,
        },
      };
      
      // Add trial period if configured and user hasn't already used their trial
      if (!isPackage && price.programs.trial_period_days && price.programs.trial_period_days > 0) {
        const { data: trialUsage } = await supabaseAdmin
          .from('trial_usage')
          .select('id')
          .eq('user_id', user.id)
          .eq('program_id', price.programs.id)
          .maybeSingle();

        if (!trialUsage) {
          sessionData.subscription_data.trial_period_days = price.programs.trial_period_days;
        } else {
          console.log(`[CHECKOUT] User ${user.id} already used trial for program ${price.programs.id}, skipping trial period`);
        }
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
