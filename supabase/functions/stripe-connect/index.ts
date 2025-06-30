
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.21.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
});

// Rate limiting helper function
async function checkRateLimit(supabaseAdmin: any, req: Request, endpoint: string) {
  try {
    // Get client IP and clean it up
    const forwardedFor = req.headers.get('x-forwarded-for') || 
                        req.headers.get('x-real-ip') || 
                        'unknown';
    
    // Extract the first IP from comma-separated list
    const clientIp = forwardedFor.split(',')[0].trim();
    
    // Get user ID from auth header
    let userId = null;
    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabaseAdmin.auth.getUser(token);
      userId = user?.id;
    }

    // Check rate limit using the database function
    const { data: rateLimitResult, error } = await supabaseAdmin.rpc('check_rate_limit', {
      p_user_id: userId,
      p_ip_address: clientIp === 'unknown' ? null : clientIp,
      p_endpoint: endpoint,
      p_limit: endpoint === 'payment' ? 10 : 100, // Payment endpoint has stricter limits
      p_window_minutes: 60
    });

    if (error) {
      console.error('Rate limit check error:', error);
      return { allowed: true }; // Allow on error to prevent service interruption
    }

    return rateLimitResult;
  } catch (error) {
    console.error('Rate limit check failed:', error);
    return { allowed: true }; // Allow on error
  }
}

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

    // Apply rate limiting to payment-related actions
    if (['create-payment-intent', 'confirm-purchase'].includes(action)) {
      const rateLimitResult = await checkRateLimit(supabaseAdmin, req, 'payment');
      
      if (!rateLimitResult.allowed) {
        console.log(`[RATE LIMIT] Payment action blocked: ${action}`);
        return new Response(JSON.stringify({
          error: 'Rate limit exceeded',
          message: `Too many payment requests. Please wait before trying again.`,
          reset_time: rateLimitResult.reset_time,
          current_count: rateLimitResult.current_count,
          limit: rateLimitResult.limit
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 429,
        });
      }

      console.log(`[RATE LIMIT] Payment action allowed: ${action} (${rateLimitResult.current_count}/${rateLimitResult.limit})`);
    }

    switch (action) {
      case 'create-connect-account': {
        // Apply rate limiting for account creation
        const rateLimitResult = await checkRateLimit(supabaseAdmin, req, 'general');
        if (!rateLimitResult.allowed) {
          return new Response(JSON.stringify({
            error: 'Rate limit exceeded',
            message: 'Too many requests. Please wait before trying again.'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 429,
          });
        }

        const { country = 'US' } = payload;
        
        console.log(`[STRIPE CONNECT] Creating account for country: ${country}`);
        
        // Get authenticated user
        const authHeader = req.headers.get('Authorization')!;
        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

        if (authError || !user) {
          console.error(`[STRIPE CONNECT] Authentication failed: ${authError?.message}`);
          throw new Error('Authentication required');
        }

        // Create Stripe Connect account
        const account = await stripe.accounts.create({
          type: 'express',
          country: country,
          email: user.email,
          capabilities: {
            card_payments: { requested: true },
            transfers: { requested: true },
          },
        });

        console.log(`[STRIPE CONNECT] Account created: ${account.id}`);

        // Update user profile with Stripe account ID
        const { error: updateError } = await supabaseAdmin
          .from('profiles')
          .update({
            stripe_account_id: account.id,
            updated_at: new Date().toISOString(),
          })
          .eq('id', user.id);

        if (updateError) {
          console.error(`[STRIPE CONNECT] Failed to update profile: ${updateError.message}`);
          throw new Error('Failed to update profile');
        }

        return new Response(JSON.stringify({
          success: true,
          account_id: account.id,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }

      case 'create-account-link': {
        const { account_id, refresh_url, return_url } = payload;
        
        console.log(`[STRIPE CONNECT] Creating account link for: ${account_id}`);

        const accountLink = await stripe.accountLinks.create({
          account: account_id,
          refresh_url: refresh_url,
          return_url: return_url,
          type: 'account_onboarding',
        });

        console.log(`[STRIPE CONNECT] Account link created: ${accountLink.url}`);

        return new Response(JSON.stringify({
          success: true,
          url: accountLink.url,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }

      case 'create-dashboard-link': {
        const { account_id } = payload;
        
        console.log(`[STRIPE CONNECT] Creating dashboard link for: ${account_id}`);

        const loginLink = await stripe.accounts.createLoginLink(account_id);

        console.log(`[STRIPE CONNECT] Dashboard link created: ${loginLink.url}`);

        return new Response(JSON.stringify({
          success: true,
          url: loginLink.url,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }

      case 'get-account-status': {
        const { account_id } = payload;
        
        console.log(`[STRIPE CONNECT] Getting account status for: ${account_id}`);

        const account = await stripe.accounts.retrieve(account_id);

        console.log(`[STRIPE CONNECT] Account status retrieved for: ${account_id}`);

        // Get authenticated user to update their profile
        const authHeader = req.headers.get('Authorization')!;
        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

        if (!authError && user) {
          // Update profile with current Stripe status
          await supabaseAdmin
            .from('profiles')
            .update({
              stripe_onboarding_completed: account.details_submitted,
              stripe_charges_enabled: account.charges_enabled,
              stripe_payouts_enabled: account.payouts_enabled,
              updated_at: new Date().toISOString(),
            })
            .eq('id', user.id);
        }

        return new Response(JSON.stringify({
          success: true,
          details_submitted: account.details_submitted,
          charges_enabled: account.charges_enabled,
          payouts_enabled: account.payouts_enabled,
          requirements: account.requirements,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }

      case 'create-payment-intent': {
        const { program_id, amount, tradingview_username, security_validation } = payload;
        
        console.log(`[PAYMENT INTENT] Creating Stripe Checkout session with rate limit protection`);
        
        // Get program and seller details
        const { data: program, error: programError } = await supabaseAdmin
          .from('programs')
          .select('*, profiles!seller_id(*)')
          .eq('id', program_id)
          .single();

        if (programError || !program) {
          throw new Error('Program not found');
        }

        // Check if seller has a valid Stripe account
        if (!program.profiles.stripe_account_id) {
          throw new Error('Seller has not set up their payment account');
        }

        // Verify the Stripe account exists and is active
        try {
          const account = await stripe.accounts.retrieve(program.profiles.stripe_account_id);
          if (!account.charges_enabled) {
            throw new Error('Seller payment account is not ready to receive payments');
          }
        } catch (stripeError: any) {
          console.error('Stripe account verification failed:', stripeError);
          throw new Error('Seller payment account is not available');
        }

        // Calculate fees with new 5% structure
        const originalPrice = Math.round(amount * 100); // Convert to cents
        const serviceFee = Math.round(originalPrice * 0.05); // 5% service fee
        const totalAmount = originalPrice + serviceFee; // Total amount buyer pays
        const platformFee = Math.round(originalPrice * 0.05); // 5% platform fee

        console.log(`[PAYMENT INTENT] Creating Checkout session - Original: $${amount}, Service fee: $${serviceFee/100}, Total: $${totalAmount/100}, Platform fee: $${platformFee/100}`);

        // Get origin for success/cancel URLs
        const origin = req.headers.get('origin') || 'http://localhost:3000';

        // Create Stripe Checkout session instead of payment intent
        const session = await stripe.checkout.sessions.create({
          payment_method_types: ['card'],
          line_items: [
            {
              price_data: {
                currency: 'usd',
                product_data: {
                  name: program.title,
                  description: `Pine Script: ${program.title}`,
                },
                unit_amount: totalAmount,
              },
              quantity: 1,
            },
          ],
          mode: 'payment',
          success_url: `${origin}/program/${program_id}?success=true`,
          cancel_url: `${origin}/program/${program_id}?canceled=true`,
          payment_intent_data: {
            application_fee_amount: platformFee,
            transfer_data: {
              destination: program.profiles.stripe_account_id,
            },
            metadata: {
              program_id,
              seller_id: program.seller_id,
              tradingview_username: tradingview_username || '',
              original_price: originalPrice.toString(),
              service_fee: serviceFee.toString(),
              platform_fee: platformFee.toString(),
              security_risk_score: security_validation?.risk_score?.toString() || '0',
              rate_limited: 'true'
            },
          },
        });

        console.log(`[PAYMENT INTENT] Checkout session created: ${session.id}`);

        return new Response(JSON.stringify({
          checkout_url: session.url,
          session_id: session.id,
          total_amount: totalAmount / 100,
          service_fee: serviceFee / 100,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }

      case 'confirm-purchase': {
        const { payment_intent_id, program_id, tradingview_username, security_context } = payload;

        console.log(`[PURCHASE CONFIRMATION] Starting with rate limit protection for payment_intent: ${payment_intent_id}`);

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

        // Calculate fees with new structure
        const originalPrice = program.price;
        const serviceFee = Math.round(originalPrice * 0.05 * 100) / 100; // 5% service fee
        const platformFee = Math.round(originalPrice * 0.05 * 100) / 100; // 5% platform fee
        const totalAmount = originalPrice + serviceFee;

        console.log(`[PURCHASE CONFIRMATION] Creating purchase record for buyer: ${user.id}, seller: ${program.seller_id}, original: ${originalPrice}, total: ${totalAmount}`);

        // Create purchase record with updated fee structure
        const { data: purchase, error: purchaseError } = await supabaseAdmin
          .from('purchases')
          .insert({
            buyer_id: user.id,
            seller_id: program.seller_id,
            program_id: program_id,
            amount: totalAmount, // Total amount paid by buyer
            platform_fee: platformFee, // 5% platform fee
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
          message: 'Purchase completed successfully with rate limiting protection',
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
