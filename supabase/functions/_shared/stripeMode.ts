import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

/**
 * Returns whether a given user is flagged as a test account.
 * Uses the service-role client so this can be called from any edge function.
 */
export async function isTestUser(userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false;
  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );
  const { data } = await admin
    .from("profiles")
    .select("is_test_account")
    .eq("id", userId)
    .maybeSingle();
  return !!data?.is_test_account;
}

/**
 * Returns a Stripe client using either sandbox or live keys.
 * If `isTest` is true and STRIPE_SECRET_KEY_TEST is set, uses the sandbox key.
 * Falls back to the live key otherwise.
 */
export function getStripeClient(isTest: boolean): { stripe: Stripe; isTest: boolean; key: string } {
  const liveKey = Deno.env.get("STRIPE_SECRET_KEY") || "";
  const testKey = Deno.env.get("STRIPE_SECRET_KEY_TEST") || "";
  const useTest = isTest && !!testKey;
  const key = useTest ? testKey : liveKey;
  return {
    stripe: new Stripe(key, { apiVersion: "2023-10-16" }),
    isTest: useTest,
    key,
  };
}

/**
 * Convenience: fetch profile's is_test_account and return a Stripe client for that user.
 */
export async function getStripeForUser(userId: string | null | undefined) {
  const testFlag = await isTestUser(userId);
  return getStripeClient(testFlag);
}

/**
 * Returns the correct Stripe secret key (live or sandbox) for a given user's mode.
 */
export async function getStripeKeyForUser(userId: string | null | undefined): Promise<string> {
  const testFlag = await isTestUser(userId);
  const liveKey = Deno.env.get("STRIPE_SECRET_KEY") || "";
  const testKey = Deno.env.get("STRIPE_SECRET_KEY_TEST") || "";
  return testFlag && testKey ? testKey : liveKey;
}

/**
 * Pick webhook secret based on `?mode=test` query param.
 */
export function getWebhookSecret(url: URL): { secret: string; isTest: boolean } {
  const isTest = url.searchParams.get("mode") === "test";
  const secret = isTest
    ? (Deno.env.get("STRIPE_WEBHOOK_SECRET_TEST") || "")
    : (Deno.env.get("STRIPE_WEBHOOK_SECRET") || "");
  return { secret, isTest };
}