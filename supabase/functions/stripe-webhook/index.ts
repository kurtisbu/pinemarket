import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper function to trigger TradingView script access assignment
async function triggerScriptAssignment(
  assignmentId: string,
  pineId: string,
  tradingviewUsername: string,
  accessType: string
): Promise<void> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("[WEBHOOK] Missing Supabase credentials for TradingView service call");
    return;
  }
  
  try {
    console.log(`[WEBHOOK] Triggering TradingView assignment for: ${assignmentId}`);
    
    const response = await fetch(`${supabaseUrl}/functions/v1/tradingview-service`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        action: 'assign-script-access',
        pine_id: pineId,
        tradingview_username: tradingviewUsername,
        assignment_id: assignmentId,
        access_type: accessType,
      }),
    });
    
    const result = await response.json();
    
    if (response.ok) {
      console.log(`[WEBHOOK] TradingView assignment successful for ${assignmentId}:`, result);
    } else {
      console.error(`[WEBHOOK] TradingView assignment failed for ${assignmentId}:`, result);
    }
  } catch (error) {
    console.error(`[WEBHOOK] Error calling TradingView service for ${assignmentId}:`, error);
  }
}

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

    const event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);

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
  const packageId = session.metadata.package_id;
  const priceId = session.metadata.price_id;
  const userId = session.metadata.user_id;
  const sellerId = session.metadata.seller_id;
  const priceType = session.metadata.price_type;
  const isPackage = session.metadata.is_package === 'true';
  const tradingviewUsername = session.metadata.tradingview_username;
  const feePercentFromMetadata = session.metadata.fee_percent ? parseFloat(session.metadata.fee_percent) : null;

  if ((!programId && !packageId) || !priceId || !userId) {
    console.error("[WEBHOOK] Missing required metadata");
    return;
  }

  // Validate program/package still exists and is published before processing
  if (isPackage && packageId) {
    const { data: pkg, error: pkgError } = await supabaseAdmin
      .from('program_packages')
      .select('status, seller_id')
      .eq('id', packageId)
      .single();
    
    if (pkgError || !pkg) {
      console.error("[WEBHOOK] Package not found:", packageId);
      return;
    }
    
    if (pkg.status !== 'published') {
      console.error("[WEBHOOK] Package is not published:", packageId, pkg.status);
      return;
    }
    
    // Verify seller_id matches metadata
    if (pkg.seller_id !== sellerId) {
      console.error("[WEBHOOK] Seller ID mismatch for package:", packageId);
      return;
    }
  } else if (programId) {
    const { data: program, error: programError } = await supabaseAdmin
      .from('programs')
      .select('status, seller_id')
      .eq('id', programId)
      .single();
    
    if (programError || !program) {
      console.error("[WEBHOOK] Program not found:", programId);
      return;
    }
    
    if (program.status !== 'published') {
      console.error("[WEBHOOK] Program is not published:", programId, program.status);
      return;
    }
    
    // Verify seller_id matches metadata
    if (program.seller_id !== sellerId) {
      console.error("[WEBHOOK] Seller ID mismatch for program:", programId);
      return;
    }
  }

  // Get price details (either program or package price)
  let amount = 0;
  if (isPackage) {
    const { data: packagePrice } = await supabaseAdmin
      .from('package_prices')
      .select('amount')
      .eq('id', priceId)
      .single();
    amount = packagePrice?.amount || 0;
  } else {
    const { data: programPrice } = await supabaseAdmin
      .from('program_prices')
      .select('amount')
      .eq('id', priceId)
      .single();
    amount = programPrice?.amount || 0;
  }

  // Get seller's fee rate - use metadata if available, otherwise fetch from DB
  let feePercent = feePercentFromMetadata;
  if (feePercent === null) {
    const { data: feeRateResult } = await supabaseAdmin
      .rpc('get_seller_fee_rate', { seller_id: sellerId });
    feePercent = feeRateResult ?? 10.0;
  }
  
  console.log(`[WEBHOOK] Using fee rate: ${feePercent}% for seller: ${sellerId}`);

  // Calculate platform fee using dynamic rate
  const platformFee = amount * (feePercent / 100);
  const sellerOwed = amount - platformFee;

  // Create purchase record (for tracking only, payment handled by Stripe Connect)
  const { data: purchase, error: purchaseError } = await supabaseAdmin
    .from('purchases')
    .insert({
      program_id: programId || null,
      package_id: packageId || null,
      buyer_id: userId,
      seller_id: sellerId,
      amount: amount,
      platform_fee: platformFee,
      seller_owed: sellerOwed,
      status: 'completed',
      payment_intent_id: session.payment_intent || session.id,
      tradingview_username: tradingviewUsername,
    })
    .select()
    .single();

  if (purchaseError) {
    console.error("[WEBHOOK] Failed to create purchase:", purchaseError);
    return;
  }

  console.log("[WEBHOOK] Purchase created:", purchase.id);

  // Create script assignments
  if (isPackage && packageId) {
    // Get all programs in the package
    const { data: packagePrograms } = await supabaseAdmin
      .from('package_programs')
      .select(`
        program_id,
        programs (
          id,
          tradingview_script_id
        )
      `)
      .eq('package_id', packageId);

    if (packagePrograms && packagePrograms.length > 0) {
      console.log(`[WEBHOOK] Creating ${packagePrograms.length} script assignments for package`);
      
      const accessType = priceType === 'recurring' ? 'subscription' : 'full_purchase';
      
      // Create script assignment for each program in the package
      for (const packageProgram of packagePrograms) {
        const pineId = packageProgram.programs.tradingview_script_id;
        
        const { data: assignment, error: assignError } = await supabaseAdmin
          .from('script_assignments')
          .insert({
            purchase_id: purchase.id,
            program_id: packageProgram.program_id,
            buyer_id: userId,
            seller_id: sellerId,
            status: 'pending',
            access_type: accessType,
            is_trial: false,
            tradingview_username: tradingviewUsername,
            pine_id: pineId,
            tradingview_script_id: pineId,
          })
          .select()
          .single();
        
        // Immediately trigger TradingView access grant
        if (!assignError && assignment && pineId && tradingviewUsername) {
          await triggerScriptAssignment(
            assignment.id,
            pineId,
            tradingviewUsername,
            accessType
          );
        }
      }
      
      console.log("[WEBHOOK] All script assignments created and triggered for package");
    }
  } else if (programId) {
    // Single program purchase - get all linked scripts from program_scripts
    const { data: programScripts, error: psError } = await supabaseAdmin
      .from('program_scripts')
      .select(`
        tradingview_script_id,
        tradingview_scripts (
          pine_id
        )
      `)
      .eq('program_id', programId)
      .order('display_order');

    if (psError) {
      console.error("[WEBHOOK] Error fetching program scripts:", psError);
    }

    if (programScripts && programScripts.length > 0) {
      console.log(`[WEBHOOK] Creating ${programScripts.length} script assignments for program`);
      
      const accessType = priceType === 'recurring' ? 'subscription' : 'full_purchase';
      
      // Create script assignment for each linked TradingView script
      for (const ps of programScripts) {
        const pineId = ps.tradingview_scripts?.pine_id || null;
        
        const { data: assignment, error: assignError } = await supabaseAdmin
          .from('script_assignments')
          .insert({
            purchase_id: purchase.id,
            program_id: programId,
            buyer_id: userId,
            seller_id: sellerId,
            status: 'pending',
            access_type: accessType,
            is_trial: false,
            tradingview_username: tradingviewUsername,
            pine_id: pineId,
            tradingview_script_id: pineId,
          })
          .select()
          .single();
        
        // Immediately trigger TradingView access grant
        if (!assignError && assignment && pineId && tradingviewUsername) {
          await triggerScriptAssignment(
            assignment.id,
            pineId,
            tradingviewUsername,
            accessType
          );
        }
      }
      
      console.log("[WEBHOOK] All script assignments created and triggered for program");
    } else {
      // Fallback: Check legacy tradingview_script_id column
      const { data: program } = await supabaseAdmin
        .from('programs')
        .select('tradingview_script_id')
        .eq('id', programId)
        .single();

      if (program?.tradingview_script_id) {
        const accessType = priceType === 'recurring' ? 'subscription' : 'full_purchase';
        const pineId = program.tradingview_script_id;
        
        const { data: assignment, error: assignError } = await supabaseAdmin
          .from('script_assignments')
          .insert({
            purchase_id: purchase.id,
            program_id: programId,
            buyer_id: userId,
            seller_id: sellerId,
            status: 'pending',
            access_type: accessType,
            is_trial: false,
            tradingview_username: tradingviewUsername,
            pine_id: pineId,
            tradingview_script_id: pineId,
          })
          .select()
          .single();
        
        // Immediately trigger TradingView access grant
        if (!assignError && assignment && tradingviewUsername) {
          await triggerScriptAssignment(
            assignment.id,
            pineId,
            tradingviewUsername,
            accessType
          );
        }
        
        console.log("[WEBHOOK] Script assignment created and triggered using legacy tradingview_script_id");
      } else {
        console.log("[WEBHOOK] No scripts found for program:", programId);
      }
    }
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
