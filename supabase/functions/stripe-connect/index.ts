
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const stripe = Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  httpClient: Stripe.createFetchHttpClient(),
});
const cryptoProvider = Stripe.createSubtleCryptoProvider();

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { action, ...payload } = await req.json();

    switch (action) {
      case 'create-payment-intent': {
        const { program_id, amount, tradingview_username } = payload;
        
        // Get program and seller details
        const { data: program, error: programError } = await supabaseAdmin
          .from('programs')
          .select('*, profiles!seller_id(*)')
          .eq('id', program_id)
          .single();

        if (programError || !program) {
          throw new Error('Program not found');
        }

        // Calculate platform fee (10%)
        const platformFee = Math.round(amount * 0.10 * 100); // Convert to cents
        const sellerAmount = Math.round(amount * 100) - platformFee; // Amount seller receives

        // Create Stripe payment intent
        const paymentIntent = await stripe.paymentIntents.create({
          amount: Math.round(amount * 100), // Convert to cents
          currency: 'usd',
          application_fee_amount: platformFee,
          transfer_data: {
            destination: program.profiles.stripe_account_id,
          },
          metadata: {
            program_id,
            seller_id: program.seller_id,
            tradingview_username: tradingview_username || '',
          },
        });

        return new Response(JSON.stringify({
          payment_intent_id: paymentIntent.id,
          client_secret: paymentIntent.client_secret,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }

      case 'confirm-purchase': {
        const { payment_intent_id, program_id, tradingview_username } = payload;

        // Get current user
        const authHeader = req.headers.get('Authorization')!;
        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

        if (authError || !user) {
          throw new Error('Authentication required');
        }

        // Get program details
        const { data: program, error: programError } = await supabaseAdmin
          .from('programs')
          .select('*, profiles!seller_id(*)')
          .eq('id', program_id)
          .single();

        if (programError || !program) {
          throw new Error('Program not found');
        }

        // Calculate fees
        const platformFee = Math.round(program.price * 0.10 * 100) / 100;

        // Create purchase record
        const { data: purchase, error: purchaseError } = await supabaseAdmin
          .from('purchases')
          .insert({
            buyer_id: user.id,
            seller_id: program.seller_id,
            program_id: program_id,
            amount: program.price,
            platform_fee: platformFee,
            payment_intent_id: payment_intent_id,
            tradingview_username: tradingview_username,
            status: 'completed',
          })
          .select()
          .single();

        if (purchaseError) {
          throw new Error('Failed to create purchase record');
        }

        // Get seller's TradingView script for this program
        const { data: script, error: scriptError } = await supabaseAdmin
          .from('tradingview_scripts')
          .select('*')
          .eq('user_id', program.seller_id)
          .eq('script_id', program.tradingview_script_id)
          .single();

        if (script && script.pine_id && tradingview_username) {
          // Create script assignment record
          const { data: assignment, error: assignmentError } = await supabaseAdmin
            .from('script_assignments')
            .insert({
              purchase_id: purchase.id,
              buyer_id: user.id,
              seller_id: program.seller_id,
              program_id: program_id,
              tradingview_script_id: script.script_id,
              pine_id: script.pine_id,
              tradingview_username: tradingview_username,
              status: 'pending',
            })
            .select()
            .single();

          if (!assignmentError && assignment) {
            // Trigger automatic script assignment
            try {
              const { data: assignmentResult, error: assignmentServiceError } = await supabaseAdmin.functions.invoke('tradingview-service', {
                body: {
                  action: 'assign-script-access',
                  pine_id: script.pine_id,
                  tradingview_username: tradingview_username,
                  assignment_id: assignment.id,
                },
              });

              console.log('Script assignment result:', assignmentResult);
              if (assignmentServiceError) {
                console.error('Script assignment failed:', assignmentServiceError);
              }
            } catch (assignError) {
              console.error('Failed to trigger script assignment:', assignError);
              // Don't fail the purchase if assignment fails - it can be retried
            }
          }
        }

        return new Response(JSON.stringify({
          success: true,
          purchase_id: purchase.id,
          message: 'Purchase completed successfully',
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }

      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        });
    }
  } catch (error: any) {
    console.error('Stripe Connect error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
