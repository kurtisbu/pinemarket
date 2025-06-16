
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from 'https://esm.sh/stripe@14.21.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;

    if (!user) {
      throw new Error('Unauthorized');
    }

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2023-10-16',
    });

    const { action, ...payload } = await req.json();

    switch (action) {
      case 'create-connect-account': {
        const account = await stripe.accounts.create({
          type: 'express',
          country: payload.country || 'US',
          email: user.email,
        });

        // Update profile with Stripe account ID
        await supabaseClient
          .from('profiles')
          .update({ stripe_account_id: account.id })
          .eq('id', user.id);

        return new Response(
          JSON.stringify({ account_id: account.id }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'create-account-link': {
        const { account_id, refresh_url, return_url } = payload;
        
        const accountLink = await stripe.accountLinks.create({
          account: account_id,
          refresh_url,
          return_url,
          type: 'account_onboarding',
        });

        return new Response(
          JSON.stringify({ url: accountLink.url }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'get-account-status': {
        const { account_id } = payload;
        
        const account = await stripe.accounts.retrieve(account_id);
        
        // Update profile with current status
        await supabaseClient
          .from('profiles')
          .update({
            stripe_onboarding_completed: account.details_submitted,
            stripe_charges_enabled: account.charges_enabled,
            stripe_payouts_enabled: account.payouts_enabled,
          })
          .eq('id', user.id);

        return new Response(
          JSON.stringify({
            details_submitted: account.details_submitted,
            charges_enabled: account.charges_enabled,
            payouts_enabled: account.payouts_enabled,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'create-payment-intent': {
        const { program_id, amount } = payload;
        
        // Get program and seller info
        const { data: program } = await supabaseClient
          .from('programs')
          .select('*, profiles!seller_id(*)')
          .eq('id', program_id)
          .single();

        if (!program?.profiles?.stripe_account_id) {
          throw new Error('Seller has not connected their Stripe account');
        }

        // Calculate platform fee (5%)
        const platformFee = Math.round(amount * 0.05);
        const sellerAmount = amount - platformFee;

        const paymentIntent = await stripe.paymentIntents.create({
          amount: amount * 100, // Convert to cents
          currency: 'usd',
          application_fee_amount: platformFee * 100,
          transfer_data: {
            destination: program.profiles.stripe_account_id,
          },
          metadata: {
            program_id,
            buyer_id: user.id,
            seller_id: program.seller_id,
          },
        });

        return new Response(
          JSON.stringify({ 
            client_secret: paymentIntent.client_secret,
            payment_intent_id: paymentIntent.id 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'confirm-purchase': {
        const { payment_intent_id, program_id } = payload;
        
        // Get payment intent from Stripe
        const paymentIntent = await stripe.paymentIntents.retrieve(payment_intent_id);
        
        if (paymentIntent.status === 'succeeded') {
          // Get program info
          const { data: program } = await supabaseClient
            .from('programs')
            .select('price, seller_id')
            .eq('id', program_id)
            .single();

          const platformFee = Math.round(program.price * 0.05);

          // Create purchase record
          const { data: purchase } = await supabaseClient
            .from('purchases')
            .insert({
              buyer_id: user.id,
              seller_id: program.seller_id,
              program_id,
              amount: program.price,
              platform_fee: platformFee,
              payment_intent_id,
              status: 'completed',
            })
            .select()
            .single();

          // Create script assignment record
          await supabaseClient
            .from('script_assignments')
            .insert({
              buyer_id: user.id,
              seller_id: program.seller_id,
              program_id,
              purchase_id: purchase.id,
              status: 'pending',
            });

          return new Response(
            JSON.stringify({ success: true, purchase_id: purchase.id }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } else {
          throw new Error('Payment not completed');
        }
      }

      case 'create-dashboard-link': {
        const { account_id } = payload;
        
        const link = await stripe.accounts.createLoginLink(account_id);

        return new Response(
          JSON.stringify({ url: link.url }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        throw new Error('Unknown action');
    }
  } catch (error) {
    console.error('Stripe Connect error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
