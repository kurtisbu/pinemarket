
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2023-10-16",
});

const supabaseClient = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

serve(async (req) => {
  const signature = req.headers.get("stripe-signature");
  const body = await req.text();

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature!,
      Deno.env.get("STRIPE_WEBHOOK_SECRET") || ""
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return new Response("Webhook signature verification failed", { status: 400 });
  }

  console.log("Processing webhook event:", event.type);

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object);
        break;
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await handleSubscriptionChange(event.data.object);
        break;
      case "invoice.payment_succeeded":
        await handlePaymentSucceeded(event.data.object);
        break;
      case "invoice.payment_failed":
        await handlePaymentFailed(event.data.object);
        break;
    }

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("Error processing webhook:", error);
    return new Response("Error processing webhook", { status: 500 });
  }
});

async function handleCheckoutCompleted(session: any) {
  const userId = session.metadata.user_id;
  const planId = session.metadata.plan_id;
  const subscriptionId = session.subscription;

  if (!userId || !planId) return;

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  await supabaseClient.from("user_subscriptions").upsert({
    user_id: userId,
    subscription_plan_id: planId,
    stripe_subscription_id: subscriptionId,
    stripe_customer_id: subscription.customer,
    status: subscription.status,
    current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
    current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
  });

  // Grant access to subscription-based programs
  await grantSubscriptionAccess(userId, planId);
}

async function handleSubscriptionChange(subscription: any) {
  await supabaseClient
    .from("user_subscriptions")
    .update({
      status: subscription.status,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      cancel_at_period_end: subscription.cancel_at_period_end,
    })
    .eq("stripe_subscription_id", subscription.id);

  if (subscription.status === "canceled") {
    // Revoke access
    await revokeSubscriptionAccess(subscription.id);
  }
}

async function handlePaymentSucceeded(invoice: any) {
  const subscriptionId = invoice.subscription;
  
  // Extend access for active subscriptions
  const { data: userSub } = await supabaseClient
    .from("user_subscriptions")
    .select("*")
    .eq("stripe_subscription_id", subscriptionId)
    .single();

  if (userSub) {
    await grantSubscriptionAccess(userSub.user_id, userSub.subscription_plan_id);
  }
}

async function handlePaymentFailed(invoice: any) {
  const subscriptionId = invoice.subscription;
  
  await supabaseClient
    .from("user_subscriptions")
    .update({ status: "past_due" })
    .eq("stripe_subscription_id", subscriptionId);
}

async function grantSubscriptionAccess(userId: string, planId: string) {
  // Get user subscription
  const { data: userSub } = await supabaseClient
    .from("user_subscriptions")
    .select("*")
    .eq("user_id", userId)
    .eq("subscription_plan_id", planId)
    .single();

  if (!userSub) return;

  // Get programs associated with this subscription plan
  const { data: programs } = await supabaseClient
    .from("programs")
    .select("*")
    .eq("pricing_model", "subscription")
    .eq("subscription_plan_id", planId);

  if (!programs) return;

  // Grant access to each program
  for (const program of programs) {
    await supabaseClient.from("subscription_access").upsert({
      user_subscription_id: userSub.id,
      program_id: program.id,
      expires_at: userSub.current_period_end,
    });
  }
}

async function revokeSubscriptionAccess(subscriptionId: string) {
  const { data: userSub } = await supabaseClient
    .from("user_subscriptions")
    .select("*")
    .eq("stripe_subscription_id", subscriptionId)
    .single();

  if (userSub) {
    await supabaseClient
      .from("subscription_access")
      .delete()
      .eq("user_subscription_id", userSub.id);
  }
}
