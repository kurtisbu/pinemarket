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

  const signature = req.headers.get("stripe-signature");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

  if (!signature || !webhookSecret) {
    return new Response("Missing signature or webhook secret", { status: 400 });
  }

  try {
    const body = await req.text();
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2023-10-16",
    });

    const event = stripe.webhooks.constructEvent(body, signature, webhookSecret);

    console.log(`[WEBHOOK] Received event: ${event.type}`);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object, supabaseAdmin);
        break;
      
      case "payment_intent.succeeded":
        await handlePaymentSucceeded(event.data.object, supabaseAdmin);
        break;

      case "customer.subscription.created":
      case "customer.subscription.updated":
        await handleSubscriptionUpdate(event.data.object, supabaseAdmin);
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object, supabaseAdmin);
        break;

      default:
        console.log(`[WEBHOOK] Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("[WEBHOOK] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});

async function handleCheckoutCompleted(session: any, supabaseAdmin: any) {
  console.log("[WEBHOOK] Processing checkout.session.completed", session.id);

  const programId = session.metadata.program_id;
  const priceId = session.metadata.price_id;
  const userId = session.metadata.user_id;
  const sellerId = session.metadata.seller_id;
  const priceType = session.metadata.price_type;

  if (!programId || !priceId || !userId) {
    console.error("[WEBHOOK] Missing required metadata");
    return;
  }

  // Get price details
  const { data: price } = await supabaseAdmin
    .from('program_prices')
    .select('amount')
    .eq('id', priceId)
    .single();

  // Calculate platform fee (10%)
  const amount = price?.amount || 0;
  const platformFee = amount * 0.10;
  const sellerOwed = amount - platformFee;

  // Create purchase record
  const { data: purchase, error: purchaseError } = await supabaseAdmin
    .from('purchases')
    .insert({
      program_id: programId,
      buyer_id: userId,
      seller_id: sellerId,
      amount: amount,
      platform_fee: platformFee,
      seller_owed: sellerOwed,
      status: 'completed',
      payment_intent_id: session.payment_intent || session.id,
    })
    .select()
    .single();

  if (purchaseError) {
    console.error("[WEBHOOK] Failed to create purchase:", purchaseError);
    return;
  }

  console.log("[WEBHOOK] Purchase created:", purchase.id);

  // Update seller balance (pending)
  const { error: balanceError } = await supabaseAdmin
    .rpc('update_seller_balance', {
      p_seller_id: sellerId,
      p_amount: sellerOwed,
      p_type: 'sale'
    });

  if (balanceError) {
    console.error("[WEBHOOK] Error updating seller balance:", balanceError);
  } else {
    console.log("[WEBHOOK] Seller balance updated with pending amount:", sellerOwed);
  }

  // Get program details for script assignment
  const { data: program } = await supabaseAdmin
    .from('programs')
    .select('*')
    .eq('id', programId)
    .single();

  if (program && purchase.tradingview_username) {
    // Create script assignment
    await supabaseAdmin
      .from('script_assignments')
      .insert({
        purchase_id: purchase.id,
        program_id: programId,
        buyer_id: userId,
        seller_id: sellerId,
        status: 'pending',
        access_type: priceType === 'recurring' ? 'subscription' : 'full_purchase',
        is_trial: false,
        tradingview_username: purchase.tradingview_username,
        pine_id: program.tradingview_script_id,
        tradingview_script_id: program.tradingview_script_id,
      });
  }
}

async function handlePaymentSucceeded(paymentIntent: any, supabaseAdmin: any) {
  console.log("[WEBHOOK] Processing payment_intent.succeeded", paymentIntent.id);
  
  // Update purchase status if needed
  await supabaseAdmin
    .from('purchases')
    .update({ status: 'completed' })
    .eq('payment_intent_id', paymentIntent.id);
}

async function handleSubscriptionUpdate(subscription: any, supabaseAdmin: any) {
  console.log("[WEBHOOK] Processing subscription update", subscription.id);
  
  // You can extend this to track subscription status changes
  // For now, the checkout.session.completed handler creates the initial purchase
}

async function handleSubscriptionDeleted(subscription: any, supabaseAdmin: any) {
  console.log("[WEBHOOK] Processing subscription deletion", subscription.id);
  
  // Find and revoke access for this subscription
  const { data: purchases } = await supabaseAdmin
    .from('purchases')
    .select('id')
    .eq('payment_intent_id', subscription.id)
    .eq('status', 'completed');

  if (purchases && purchases.length > 0) {
    for (const purchase of purchases) {
      // Update assignment status to revoked
      await supabaseAdmin
        .from('script_assignments')
        .update({ 
          status: 'revoked',
          expires_at: new Date().toISOString()
        })
        .eq('purchase_id', purchase.id);
    }
  }
}
