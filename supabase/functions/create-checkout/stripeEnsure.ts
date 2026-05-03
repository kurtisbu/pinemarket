import Stripe from "https://esm.sh/stripe@14.21.0";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

type PriceType = "one_time" | "recurring";

// Default buyer-side platform fee percentage (added on top of the listed price)
export const BUYER_FEE_PERCENT = 5.0;

export function calculateBuyerInclusiveAmount(listAmount: number): number {
  // Round to nearest cent
  return Math.round(listAmount * (1 + BUYER_FEE_PERCENT / 100) * 100) / 100;
}

function mapRecurring(interval: string | null): { interval: "month" | "year"; interval_count: number } | null {
  if (!interval) return null;
  if (interval === "month") return { interval: "month", interval_count: 1 };
  if (interval === "3_months") return { interval: "month", interval_count: 3 };
  if (interval === "year") return { interval: "year", interval_count: 1 };
  return null;
}

async function ensureStripeProductForProgram(
  stripe: Stripe,
  supabaseAdmin: SupabaseClient,
  program: { id: string; title: string; description: string | null; seller_id: string; stripe_product_id: string | null },
): Promise<string> {
  if (program.stripe_product_id) return program.stripe_product_id;

  const created = await stripe.products.create({
    name: program.title,
    description: program.description || undefined,
    metadata: {
      program_id: program.id,
      seller_id: program.seller_id,
      resource_type: "program",
    },
  });

  const { error: updateErr } = await supabaseAdmin
    .from("programs")
    .update({ stripe_product_id: created.id })
    .eq("id", program.id);

  if (updateErr) {
    console.error("[CHECKOUT] Failed to persist programs.stripe_product_id:", updateErr);
  }

  return created.id;
}

export async function ensureStripePriceForProgramPrice(
  stripe: Stripe,
  supabaseAdmin: SupabaseClient,
  programPrice: {
    id: string;
    price_type: PriceType;
    amount: number;
    currency: string | null;
    interval: string | null;
    display_name: string;
    stripe_price_id: string | null;
    programs: {
      id: string;
      title: string;
      description: string | null;
      seller_id: string;
      stripe_product_id: string | null;
    };
  },
): Promise<string> {
  if (programPrice.stripe_price_id) return programPrice.stripe_price_id;

  console.log(`[CHECKOUT] stripe_price_id missing for program_prices.${programPrice.id}; creating in Stripe...`);

  const productId = await ensureStripeProductForProgram(stripe, supabaseAdmin, {
    id: programPrice.programs.id,
    title: programPrice.programs.title,
    description: programPrice.programs.description,
    seller_id: programPrice.programs.seller_id,
    stripe_product_id: programPrice.programs.stripe_product_id,
  });

  const stripePriceData: Stripe.PriceCreateParams = {
    product: productId,
    currency: programPrice.currency || "usd",
    unit_amount: Math.round(programPrice.amount * 100),
    nickname: programPrice.display_name,
    metadata: {
      program_id: programPrice.programs.id,
      price_id: programPrice.id,
      price_type: programPrice.price_type,
      resource_type: "program",
    },
  };

  if (programPrice.price_type === "recurring") {
    const recurring = mapRecurring(programPrice.interval);
    if (recurring) {
      stripePriceData.recurring = recurring;
    }
  }

  const createdPrice = await stripe.prices.create(stripePriceData);

  const { error: updateErr } = await supabaseAdmin
    .from("program_prices")
    .update({ stripe_price_id: createdPrice.id })
    .eq("id", programPrice.id);

  if (updateErr) {
    console.error("[CHECKOUT] Failed to persist program_prices.stripe_price_id:", updateErr);
  }

  return createdPrice.id;
}

export async function ensureStripePriceForPackagePrice(
  stripe: Stripe,
  supabaseAdmin: SupabaseClient,
  packagePrice: {
    id: string;
    price_type: PriceType;
    amount: number;
    currency: string | null;
    interval: string | null;
    display_name: string;
    stripe_price_id: string | null;
    program_packages: {
      id: string;
      title: string;
      description: string | null;
      seller_id: string;
    };
  },
): Promise<string> {
  if (packagePrice.stripe_price_id) return packagePrice.stripe_price_id;

  console.log(`[CHECKOUT] stripe_price_id missing for package_prices.${packagePrice.id}; creating in Stripe...`);

  const createdProduct = await stripe.products.create({
    name: packagePrice.program_packages.title,
    description: packagePrice.program_packages.description || undefined,
    metadata: {
      package_id: packagePrice.program_packages.id,
      seller_id: packagePrice.program_packages.seller_id,
      resource_type: "package",
    },
  });

  const stripePriceData: Stripe.PriceCreateParams = {
    product: createdProduct.id,
    currency: packagePrice.currency || "usd",
    unit_amount: Math.round(packagePrice.amount * 100),
    nickname: packagePrice.display_name,
    metadata: {
      package_id: packagePrice.program_packages.id,
      price_id: packagePrice.id,
      price_type: packagePrice.price_type,
      resource_type: "package",
    },
  };

  if (packagePrice.price_type === "recurring") {
    const recurring = mapRecurring(packagePrice.interval);
    if (recurring) {
      stripePriceData.recurring = recurring;
    }
  }

  const createdPrice = await stripe.prices.create(stripePriceData);

  const { error: updateErr } = await supabaseAdmin
    .from("package_prices")
    .update({ stripe_price_id: createdPrice.id })
    .eq("id", packagePrice.id);

  if (updateErr) {
    console.error("[CHECKOUT] Failed to persist package_prices.stripe_price_id:", updateErr);
  }

  return createdPrice.id;
}

// ---------------------------------------------------------------------------
// Buyer-inclusive Stripe Price objects
// ---------------------------------------------------------------------------
// These are separate Stripe Price objects whose unit_amount equals the listed
// price plus the buyer-side platform fee. The buyer is charged this inflated
// amount; the platform's `application_fee_amount` then captures both the
// buyer-side fee and the seller-side fee, leaving the seller with
// `listAmount - sellerFee`.

export async function ensureBuyerInclusivePriceForProgramPrice(
  stripe: Stripe,
  supabaseAdmin: SupabaseClient,
  programPrice: {
    id: string;
    price_type: PriceType;
    amount: number;
    currency: string | null;
    interval: string | null;
    display_name: string;
    stripe_buyer_inclusive_price_id: string | null;
    programs: {
      id: string;
      title: string;
      description: string | null;
      seller_id: string;
      stripe_product_id: string | null;
    };
  },
): Promise<string> {
  if (programPrice.stripe_buyer_inclusive_price_id) return programPrice.stripe_buyer_inclusive_price_id;

  const productId = await ensureStripeProductForProgram(stripe, supabaseAdmin, {
    id: programPrice.programs.id,
    title: programPrice.programs.title,
    description: programPrice.programs.description,
    seller_id: programPrice.programs.seller_id,
    stripe_product_id: programPrice.programs.stripe_product_id,
  });

  const buyerAmount = calculateBuyerInclusiveAmount(programPrice.amount);

  const priceData: Stripe.PriceCreateParams = {
    product: productId,
    currency: programPrice.currency || "usd",
    unit_amount: Math.round(buyerAmount * 100),
    nickname: `${programPrice.display_name} (incl. platform fee)`,
    metadata: {
      program_id: programPrice.programs.id,
      price_id: programPrice.id,
      price_type: programPrice.price_type,
      resource_type: "program",
      buyer_inclusive: "true",
      buyer_fee_percent: BUYER_FEE_PERCENT.toString(),
    },
  };

  if (programPrice.price_type === "recurring") {
    const recurring = mapRecurring(programPrice.interval);
    if (recurring) priceData.recurring = recurring;
  }

  const created = await stripe.prices.create(priceData);

  const { error: updateErr } = await supabaseAdmin
    .from("program_prices")
    .update({ stripe_buyer_inclusive_price_id: created.id })
    .eq("id", programPrice.id);

  if (updateErr) {
    console.error("[CHECKOUT] Failed to persist program_prices.stripe_buyer_inclusive_price_id:", updateErr);
  }

  return created.id;
}

export async function ensureBuyerInclusivePriceForPackagePrice(
  stripe: Stripe,
  supabaseAdmin: SupabaseClient,
  packagePrice: {
    id: string;
    price_type: PriceType;
    amount: number;
    currency: string | null;
    interval: string | null;
    display_name: string;
    stripe_price_id: string | null;
    stripe_buyer_inclusive_price_id: string | null;
    program_packages: {
      id: string;
      title: string;
      description: string | null;
      seller_id: string;
    };
  },
): Promise<string> {
  if (packagePrice.stripe_buyer_inclusive_price_id) return packagePrice.stripe_buyer_inclusive_price_id;

  // Reuse product if a base price already exists; otherwise create a product.
  let productId: string | null = null;
  if (packagePrice.stripe_price_id) {
    const existing = await stripe.prices.retrieve(packagePrice.stripe_price_id);
    productId = typeof existing.product === "string" ? existing.product : existing.product.id;
  } else {
    const product = await stripe.products.create({
      name: packagePrice.program_packages.title,
      description: packagePrice.program_packages.description || undefined,
      metadata: {
        package_id: packagePrice.program_packages.id,
        seller_id: packagePrice.program_packages.seller_id,
        resource_type: "package",
      },
    });
    productId = product.id;
  }

  const buyerAmount = calculateBuyerInclusiveAmount(packagePrice.amount);

  const priceData: Stripe.PriceCreateParams = {
    product: productId!,
    currency: packagePrice.currency || "usd",
    unit_amount: Math.round(buyerAmount * 100),
    nickname: `${packagePrice.display_name} (incl. platform fee)`,
    metadata: {
      package_id: packagePrice.program_packages.id,
      price_id: packagePrice.id,
      price_type: packagePrice.price_type,
      resource_type: "package",
      buyer_inclusive: "true",
      buyer_fee_percent: BUYER_FEE_PERCENT.toString(),
    },
  };

  if (packagePrice.price_type === "recurring") {
    const recurring = mapRecurring(packagePrice.interval);
    if (recurring) priceData.recurring = recurring;
  }

  const created = await stripe.prices.create(priceData);

  const { error: updateErr } = await supabaseAdmin
    .from("package_prices")
    .update({ stripe_buyer_inclusive_price_id: created.id })
    .eq("id", packagePrice.id);

  if (updateErr) {
    console.error("[CHECKOUT] Failed to persist package_prices.stripe_buyer_inclusive_price_id:", updateErr);
  }

  return created.id;
}
