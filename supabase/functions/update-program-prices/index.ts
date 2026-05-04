import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface IncomingPrice {
  id?: string;
  price_type: 'one_time' | 'recurring';
  amount: number | string;
  interval?: 'month' | '3_months' | 'year' | null;
  display_name: string;
  description?: string | null;
  currency?: string;
  sort_order?: number;
}

function mapInterval(interval?: string | null): { interval: 'month' | 'year'; interval_count: number } | null {
  if (!interval) return null;
  if (interval === 'month') return { interval: 'month', interval_count: 1 };
  if (interval === '3_months') return { interval: 'month', interval_count: 3 };
  if (interval === 'year') return { interval: 'year', interval_count: 1 };
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseService = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const supabaseUser = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await supabaseUser.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const body = await req.json();
    const programId: string | undefined = body.programId;
    const prices: IncomingPrice[] = body.prices || [];

    if (!programId || !Array.isArray(prices)) {
      return new Response(JSON.stringify({ error: "programId and prices required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseService);

    const { data: program, error: progErr } = await supabaseAdmin
      .from("programs")
      .select("id, seller_id, title, description, stripe_product_id")
      .eq("id", programId)
      .single();
    if (progErr || !program) {
      return new Response(JSON.stringify({ error: "Program not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (program.seller_id !== userId) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2023-10-16",
    });

    let stripeProductId = program.stripe_product_id;
    if (!stripeProductId) {
      const product = await stripe.products.create({
        name: program.title,
        description: program.description || undefined,
        metadata: { program_id: program.id, seller_id: program.seller_id, resource_type: "program" },
      });
      stripeProductId = product.id;
      await supabaseAdmin.from("programs").update({ stripe_product_id: stripeProductId }).eq("id", program.id);
    }

    const { data: existingPrices, error: existingErr } = await supabaseAdmin
      .from("program_prices")
      .select("*")
      .eq("program_id", programId)
      .eq("is_active", true);
    if (existingErr) throw existingErr;

    const incomingIds = new Set(prices.filter((p) => p.id).map((p) => p.id as string));

    for (const ex of existingPrices || []) {
      if (!incomingIds.has(ex.id)) {
        await supabaseAdmin.from("program_prices").update({ is_active: false }).eq("id", ex.id);
        if (ex.stripe_price_id) {
          try {
            await stripe.prices.update(ex.stripe_price_id, { active: false });
          } catch (e) {
            console.error("[UPDATE-PRICES] archive failed:", ex.stripe_price_id, e);
          }
        }
      }
    }

    const results: any[] = [];
    for (let i = 0; i < prices.length; i++) {
      const p = prices[i];
      const amountNum = typeof p.amount === "string" ? parseFloat(p.amount) : p.amount;
      if (isNaN(amountNum) || amountNum < 0) throw new Error(`Invalid amount for price "${p.display_name}"`);
      if (!p.display_name?.trim()) throw new Error("Display name required for all prices");
      if (p.price_type === "recurring" && !p.interval) throw new Error(`Interval required for recurring price "${p.display_name}"`);

      const sortOrder = p.sort_order ?? i;
      const currency = (p.currency || "USD").toLowerCase();
      const existing = p.id ? (existingPrices || []).find((e) => e.id === p.id) : null;

      const pricingChanged =
        !existing ||
        Number(existing.amount) !== amountNum ||
        existing.price_type !== p.price_type ||
        (existing.interval || null) !== (p.interval || null) ||
        (existing.currency || "USD").toLowerCase() !== currency;

      if (existing && !pricingChanged) {
        await supabaseAdmin
          .from("program_prices")
          .update({
            display_name: p.display_name,
            description: p.description || null,
            sort_order: sortOrder,
          })
          .eq("id", existing.id);

        if (existing.stripe_price_id) {
          try {
            await stripe.prices.update(existing.stripe_price_id, { nickname: p.display_name });
          } catch (e) {
            console.error("[UPDATE-PRICES] nickname update failed:", e);
          }
        }
        results.push({ id: existing.id, action: "updated_metadata" });
        continue;
      }

      const stripePriceData: any = {
        product: stripeProductId,
        currency,
        unit_amount: Math.round(amountNum * 100),
        nickname: p.display_name,
        metadata: { program_id: programId, price_type: p.price_type, resource_type: "program" },
      };
      const recurring = mapInterval(p.interval);
      if (p.price_type === "recurring" && recurring) stripePriceData.recurring = recurring;
      const stripePrice = await stripe.prices.create(stripePriceData);

      if (existing) {
        if (existing.stripe_price_id) {
          try {
            await stripe.prices.update(existing.stripe_price_id, { active: false });
          } catch (e) {
            console.error("[UPDATE-PRICES] archive old failed:", e);
          }
        }
        await supabaseAdmin
          .from("program_prices")
          .update({
            display_name: p.display_name,
            description: p.description || null,
            amount: amountNum,
            currency: currency.toUpperCase(),
            price_type: p.price_type,
            interval: p.interval || null,
            stripe_price_id: stripePrice.id,
            sort_order: sortOrder,
            is_active: true,
          })
          .eq("id", existing.id);
        results.push({ id: existing.id, action: "replaced_price", stripe_price_id: stripePrice.id });
      } else {
        const { data: inserted, error: insertErr } = await supabaseAdmin
          .from("program_prices")
          .insert({
            program_id: programId,
            display_name: p.display_name,
            description: p.description || null,
            amount: amountNum,
            currency: currency.toUpperCase(),
            price_type: p.price_type,
            interval: p.interval || null,
            stripe_price_id: stripePrice.id,
            sort_order: sortOrder,
            is_active: true,
          })
          .select()
          .single();
        if (insertErr) throw insertErr;
        results.push({ id: inserted.id, action: "created", stripe_price_id: stripePrice.id });
      }
    }

    try {
      await stripe.products.update(stripeProductId, {
        name: program.title,
        description: program.description || undefined,
      });
    } catch (e) {
      console.error("[UPDATE-PRICES] product update failed:", e);
    }

    return new Response(JSON.stringify({ success: true, results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[UPDATE-PRICES] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
