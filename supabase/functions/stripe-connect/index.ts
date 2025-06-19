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

        // Enhanced logging for debugging
        console.log(`[PURCHASE CONFIRMATION] Starting purchase confirmation for payment_intent: ${payment_intent_id}, program: ${program_id}, username: ${tradingview_username}`);

        // Get current user
        const authHeader = req.headers.get('Authorization')!;
        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

        if (authError || !user) {
          console.error(`[PURCHASE CONFIRMATION] Authentication failed: ${authError?.message}`);
          throw new Error('Authentication required');
        }

        // Get program details
        const { data: program, error: programError } = await supabaseAdmin
          .from('programs')
          .select('*, profiles!seller_id(*)')
          .eq('id', program_id)
          .single();

        if (programError || !program) {
          console.error(`[PURCHASE CONFIRMATION] Program not found: ${programError?.message}`);
          throw new Error('Program not found');
        }

        // Calculate fees
        const platformFee = Math.round(program.price * 0.10 * 100) / 100;

        console.log(`[PURCHASE CONFIRMATION] Creating purchase record for buyer: ${user.id}, seller: ${program.seller_id}, amount: ${program.price}`);

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
          console.error(`[PURCHASE CONFIRMATION] Failed to create purchase record: ${purchaseError.message}`);
          throw new Error('Failed to create purchase record');
        }

        console.log(`[PURCHASE CONFIRMATION] Purchase created successfully: ${purchase.id}`);

        // Enhanced script assignment logic with comprehensive logging
        if (tradingview_username?.trim()) {
          console.log(`[SCRIPT ASSIGNMENT] Starting assignment process for username: ${tradingview_username}`);
          
          // Get seller's TradingView script for this program
          const { data: script, error: scriptError } = await supabaseAdmin
            .from('tradingview_scripts')
            .select('*')
            .eq('user_id', program.seller_id)
            .eq('script_id', program.tradingview_script_id)
            .single();

          if (scriptError) {
            console.error(`[SCRIPT ASSIGNMENT] Error fetching script: ${scriptError.message}`);
            
            // Log assignment failure in database
            await supabaseAdmin
              .from('assignment_logs')
              .insert({
                purchase_id: purchase.id,
                log_level: 'error',
                message: `Script not found: ${scriptError.message}`,
                details: { script_id: program.tradingview_script_id, seller_id: program.seller_id }
              });
          }

          if (script && script.pine_id) {
            console.log(`[SCRIPT ASSIGNMENT] Creating script assignment for purchase ${purchase.id}, pine_id: ${script.pine_id}`);
            
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
                tradingview_username: tradingview_username.trim(),
                status: 'pending',
              })
              .select()
              .single();

            if (assignmentError) {
              console.error(`[SCRIPT ASSIGNMENT] Failed to create script assignment: ${assignmentError.message}`);
              
              // Log assignment failure
              await supabaseAdmin
                .from('assignment_logs')
                .insert({
                  purchase_id: purchase.id,
                  log_level: 'error',
                  message: `Failed to create assignment record: ${assignmentError.message}`,
                  details: { assignment_error: assignmentError }
                });
            } else if (assignment) {
              console.log(`[SCRIPT ASSIGNMENT] Assignment record created: ${assignment.id}`);
              
              // Log assignment creation
              await supabaseAdmin
                .from('assignment_logs')
                .insert({
                  assignment_id: assignment.id,
                  purchase_id: purchase.id,
                  log_level: 'info',
                  message: 'Assignment record created successfully',
                  details: { pine_id: script.pine_id, username: tradingview_username }
                });
              
              // Trigger automatic script assignment with enhanced error handling
              try {
                console.log(`[SCRIPT ASSIGNMENT] Invoking TradingView service for assignment: ${assignment.id}`);
                
                const { data: assignmentResult, error: assignmentServiceError } = await supabaseAdmin.functions.invoke('tradingview-service', {
                  body: {
                    action: 'assign-script-access',
                    pine_id: script.pine_id,
                    tradingview_username: tradingview_username.trim(),
                    assignment_id: assignment.id,
                  },
                });

                if (assignmentServiceError) {
                  console.error(`[SCRIPT ASSIGNMENT] Service error: ${assignmentServiceError.message}`);
                  
                  // Update assignment with error and log
                  await supabaseAdmin
                    .from('script_assignments')
                    .update({
                      status: 'failed',
                      error_message: `Service error: ${assignmentServiceError.message}`,
                      last_attempt_at: new Date().toISOString(),
                    })
                    .eq('id', assignment.id);

                  await supabaseAdmin
                    .from('assignment_logs')
                    .insert({
                      assignment_id: assignment.id,
                      purchase_id: purchase.id,
                      log_level: 'error',
                      message: 'TradingView service invocation failed',
                      details: { service_error: assignmentServiceError.message }
                    });
                } else {
                  console.log(`[SCRIPT ASSIGNMENT] Service response: ${JSON.stringify(assignmentResult)}`);
                  
                  await supabaseAdmin
                    .from('assignment_logs')
                    .insert({
                      assignment_id: assignment.id,
                      purchase_id: purchase.id,
                      log_level: 'info',
                      message: 'TradingView service invoked successfully',
                      details: { service_response: assignmentResult }
                    });
                }
              } catch (assignError: any) {
                console.error(`[SCRIPT ASSIGNMENT] Assignment trigger failed: ${assignError.message}`);
                
                // Update assignment with error and log
                await supabaseAdmin
                  .from('script_assignments')
                  .update({
                    status: 'failed',
                    error_message: `Assignment trigger failed: ${assignError.message}`,
                    last_attempt_at: new Date().toISOString(),
                  })
                  .eq('id', assignment.id);

                await supabaseAdmin
                  .from('assignment_logs')
                  .insert({
                    assignment_id: assignment.id,
                    purchase_id: purchase.id,
                    log_level: 'error',
                    message: 'Assignment trigger failed',
                    details: { trigger_error: assignError.message, stack: assignError.stack }
                  });
              }
            }
          } else {
            console.log(`[SCRIPT ASSIGNMENT] No script found or missing pine_id for assignment`);
            
            await supabaseAdmin
              .from('assignment_logs')
              .insert({
                purchase_id: purchase.id,
                log_level: 'warning',
                message: 'No script found or missing pine_id',
                details: { script_available: !!script, pine_id: script?.pine_id }
              });
          }
        } else {
          console.log(`[SCRIPT ASSIGNMENT] No TradingView username provided, skipping assignment`);
          
          await supabaseAdmin
            .from('assignment_logs')
            .insert({
              purchase_id: purchase.id,
              log_level: 'info',
              message: 'No TradingView username provided, assignment skipped',
              details: { username_provided: false }
            });
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
