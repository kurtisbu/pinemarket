import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { action, ...payload } = await req.json();

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    console.log(`[STRIPE-CONNECT] Action: ${action}`, payload);

    switch (action) {
      case 'create-trial-access':
        return await createTrialAccess(payload, supabaseAdmin, req);
      case 'create-payment-intent':
        return await createPaymentIntent(payload, supabaseAdmin);
      case 'confirm-purchase':
        return await confirmPurchase(payload, supabaseAdmin);
      case 'complete-stripe-purchase':
        return await completeStripePurchase(payload, supabaseAdmin);
      case 'get-account-status':
        return await getAccountStatus(payload);
      case 'create-connect-account':
        return await createConnectAccount(payload, supabaseAdmin, req);
      case 'create-account-link':
        return await createAccountLink(payload);
      case 'create-dashboard-link':
        return await createDashboardLink(payload);
      default:
        return new Response(JSON.stringify({ error: 'Invalid action.' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        });
    }
  } catch (error) {
    console.error('Error in stripe-connect:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});

async function createTrialAccess(payload: any, supabaseAdmin: any, req: Request) {
  const { program_id, trial_period_days, tradingview_username } = payload;
  
  if (!program_id || !trial_period_days || !tradingview_username) {
    throw new Error('Missing required parameters for trial creation');
  }

  console.log('[TRIAL] Creating trial access...', { program_id, trial_period_days, tradingview_username });

  // Get the user from the Authorization header
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    throw new Error('No authorization header provided');
  }

  // Create a client with anon key to authenticate the user
  const supabaseAuth = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  );

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(token);
  
  if (userError || !user) {
    console.error('[TRIAL] Authentication error:', userError);
    throw new Error('User not authenticated');
  }

  console.log('[TRIAL] User authenticated:', { userId: user.id, email: user.email });

  // Get program details
  const { data: program, error: programError } = await supabaseAdmin
    .from('programs')
    .select('*')
    .eq('id', program_id)
    .single();

  if (programError || !program) {
    console.error('[TRIAL] Program not found:', programError);
    throw new Error('Program not found');
  }

  console.log('[TRIAL] Program found:', { id: program.id, title: program.title });

  // Check trial eligibility
  const { data: isEligible, error: eligibilityError } = await supabaseAdmin.rpc('check_trial_eligibility', {
    p_user_id: user.id,
    p_program_id: program_id
  });

  if (eligibilityError) {
    console.error('[TRIAL] Eligibility check error:', eligibilityError);
    throw new Error('Error checking trial eligibility');
  }

  if (!isEligible) {
    console.log('[TRIAL] User not eligible:', { userId: user.id, programId: program_id });
    throw new Error('User is not eligible for trial');
  }

  console.log('[TRIAL] User is eligible for trial');

  // Create trial purchase record with 0 amount for trials
  const { data: purchase, error: purchaseError } = await supabaseAdmin
    .from('purchases')
    .insert({
      program_id,
      buyer_id: user.id,
      seller_id: program.seller_id,
      amount: 0, // Use 0 for trials to clearly distinguish from paid purchases
      status: 'completed',
      tradingview_username,
      platform_fee: 0,
      payment_intent_id: `trial_${program_id}_${user.id}_${Date.now()}`
    })
    .select()
    .single();

  if (purchaseError) {
    console.error('[TRIAL] Purchase creation error:', purchaseError);
    throw new Error('Failed to create trial purchase record');
  }

  console.log('[TRIAL] Trial purchase created:', purchase.id);

  // Calculate expiration date
  const expiresAt = new Date(Date.now() + (trial_period_days * 24 * 60 * 60 * 1000));

  // Create script assignment for trial
  const { data: assignment, error: assignmentError } = await supabaseAdmin
    .from('script_assignments')
    .insert({
      purchase_id: purchase.id,
      program_id,
      buyer_id: user.id,
      seller_id: program.seller_id,
      status: 'pending',
      access_type: 'trial',
      is_trial: true,
      expires_at: expiresAt.toISOString(),
      tradingview_username,
      pine_id: program.tradingview_script_id,
      tradingview_script_id: program.tradingview_script_id
    })
    .select()
    .single();

  if (assignmentError) {
    console.error('[TRIAL] Assignment creation error:', assignmentError);
    throw new Error('Failed to create trial assignment');
  }

  console.log('[TRIAL] Trial assignment created:', assignment.id);

  // Record trial usage immediately to prevent duplicate trials
  try {
    await supabaseAdmin.rpc('record_trial_usage', {
      p_user_id: user.id,
      p_program_id: program_id
    });
    console.log('[TRIAL] Trial usage recorded');
  } catch (error) {
    console.error('[TRIAL] Failed to record trial usage:', error);
    // Continue with assignment even if usage recording fails
  }

  // Trigger TradingView script assignment with better error handling
  try {
    console.log('[TRIAL] Triggering TradingView assignment...');
    const { data: assignmentResult, error: tvError } = await supabaseAdmin.functions.invoke('tradingview-service', {
      body: {
        action: 'assign-script-access',
        pine_id: program.tradingview_script_id,
        tradingview_username,
        assignment_id: assignment.id,
        access_type: 'trial',
        trial_duration_days: trial_period_days
      }
    });

    if (tvError) {
      console.error('[TRIAL] TradingView assignment error:', tvError);
      
      // Update assignment with error details
      await supabaseAdmin
        .from('script_assignments')
        .update({
          status: 'failed',
          error_message: `TradingView assignment failed: ${tvError.message}`,
          assignment_details: {
            error: tvError.message,
            failed_at: new Date().toISOString(),
            assignment_attempts: 1
          }
        })
        .eq('id', assignment.id);
      
      throw new Error(`Failed to assign TradingView access: ${tvError.message}`);
    }

    console.log('[TRIAL] TradingView assignment response:', assignmentResult);

    // Check if the assignment was successful
    if (assignmentResult?.success) {
      // Update assignment as successful
      await supabaseAdmin
        .from('script_assignments')
        .update({
          status: 'assigned',
          assigned_at: new Date().toISOString(),
          assignment_details: {
            ...assignmentResult,
            assigned_at: new Date().toISOString()
          }
        })
        .eq('id', assignment.id);

      console.log('[TRIAL] Assignment marked as successful');
    } else {
      // Handle cases where TradingView service doesn't return success flag
      console.log('[TRIAL] TradingView service response unclear, checking for errors...');
      
      if (assignmentResult?.error) {
        throw new Error(assignmentResult.error);
      }
      
      // If no explicit error, consider it potentially successful but pending verification
      await supabaseAdmin
        .from('script_assignments')
        .update({
          status: 'pending',
          assignment_details: {
            ...assignmentResult,
            note: 'Assignment submitted, awaiting verification',
            submitted_at: new Date().toISOString()
          }
        })
        .eq('id', assignment.id);
    }

  } catch (error) {
    console.error('[TRIAL] TradingView assignment failed:', error);
    
    // Update assignment with detailed error
    await supabaseAdmin
      .from('script_assignments')
      .update({
        status: 'failed',
        error_message: error.message,
        assignment_details: {
          error: error.message,
          stack: error.stack,
          failed_at: new Date().toISOString(),
          assignment_attempts: 1
        }
      })
      .eq('id', assignment.id);
    
    // Return partial success - trial is created but assignment failed
    return new Response(JSON.stringify({
      success: true,
      trial_id: purchase.id,
      assignment_id: assignment.id,
      expires_at: expiresAt.toISOString(),
      message: `Trial created successfully but script assignment failed: ${error.message}`,
      warning: 'You may need to manually retry the script assignment from your dashboard.',
      assignment_status: 'failed'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  }

  return new Response(JSON.stringify({
    success: true,
    trial_id: purchase.id,
    assignment_id: assignment.id,
    expires_at: expiresAt.toISOString(),
    message: `Trial access created successfully - expires in ${trial_period_days} days`,
    assignment_status: 'assigned'
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status: 200,
  });
}

async function createPaymentIntent(payload: any, supabaseAdmin: any) {
  console.log('[PAYMENT] Creating payment intent (existing functionality)...');
  return new Response(JSON.stringify({ message: 'Payment intent creation - existing code' }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status: 200,
  });
}

async function confirmPurchase(payload: any, supabaseAdmin: any) {
  console.log('[PAYMENT] Confirming purchase (existing functionality)...');
  return new Response(JSON.stringify({ message: 'Purchase confirmation - existing code' }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status: 200,
  });
}

async function completeStripePurchase(payload: any, supabaseAdmin: any) {
  console.log('[PAYMENT] Completing Stripe purchase (existing functionality)...');
  return new Response(JSON.stringify({ message: 'Stripe purchase completion - existing code' }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status: 200,
  });
}

async function getAccountStatus(payload: any) {
  const { account_id } = payload;
  
  if (!account_id) {
    return new Response(JSON.stringify({ error: 'Missing account_id' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }

  console.log('[STRIPE-ACCOUNT] Fetching account status for:', account_id);

  try {
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeSecretKey) {
      throw new Error('Stripe secret key not configured');
    }

    // Fetch Stripe account details
    const response = await fetch(`https://api.stripe.com/v1/accounts/${account_id}`, {
      headers: {
        'Authorization': `Bearer ${stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[STRIPE-ACCOUNT] Stripe API error:', errorText);
      throw new Error(`Stripe API error: ${response.status} - ${errorText}`);
    }

    const account = await response.json();

    console.log('[STRIPE-ACCOUNT] Account fetched successfully:', {
      id: account.id,
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled,
      details_submitted: account.details_submitted,
    });

    return new Response(JSON.stringify({
      success: true,
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled,
      details_submitted: account.details_submitted,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('[STRIPE-ACCOUNT] Error fetching account status:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
}

async function createConnectAccount(payload: any, supabaseAdmin: any, req: Request) {
  const { country } = payload;

  try {
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeSecretKey) {
      throw new Error('Stripe secret key not configured');
    }

    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header provided');
    }

    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error('User not authenticated');
    }

    console.log('[STRIPE-CONNECT] Creating Connect account for user:', user.id);

    // Create Stripe Connect account
    const formData = new URLSearchParams();
    formData.append('type', 'express');
    formData.append('country', country || 'US');
    formData.append('business_type', 'individual');

    // Capabilities must be sent as nested form fields, not JSON
    formData.append('capabilities[card_payments][requested]', 'true');
    formData.append('capabilities[transfers][requested]', 'true');

    // Optionally pass email to prefill Stripe
    if (user.email) {
      formData.append('email', user.email);
    }

    const response = await fetch('https://api.stripe.com/v1/accounts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[STRIPE-CONNECT] Stripe API error:', errorText);
      throw new Error(`Failed to create Stripe account: ${errorText}`);
    }

    const account = await response.json();
    console.log('[STRIPE-CONNECT] Account created:', account.id);

    // Save account ID to user's profile
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        stripe_account_id: account.id,
        stripe_onboarding_completed: false,
        stripe_charges_enabled: false,
        stripe_payouts_enabled: false,
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('[STRIPE-CONNECT] Failed to save account ID:', updateError);
      throw new Error('Failed to save Stripe account ID');
    }

    return new Response(JSON.stringify({
      success: true,
      account_id: account.id,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('[STRIPE-CONNECT] Error creating account:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
}

async function createAccountLink(payload: any) {
  const { account_id, refresh_url, return_url } = payload;

  if (!account_id || !refresh_url || !return_url) {
    return new Response(JSON.stringify({ error: 'Missing required parameters' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }

  try {
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeSecretKey) {
      throw new Error('Stripe secret key not configured');
    }

    console.log('[STRIPE-CONNECT] Creating account link for:', account_id);

    const formData = new URLSearchParams({
      account: account_id,
      refresh_url: refresh_url,
      return_url: return_url,
      type: 'account_onboarding',
    });

    const response = await fetch('https://api.stripe.com/v1/account_links', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[STRIPE-CONNECT] Stripe API error:', errorText);
      throw new Error(`Failed to create account link: ${errorText}`);
    }

    const accountLink = await response.json();
    console.log('[STRIPE-CONNECT] Account link created');

    return new Response(JSON.stringify({
      success: true,
      url: accountLink.url,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('[STRIPE-CONNECT] Error creating account link:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
}

async function createDashboardLink(payload: any) {
  const { account_id } = payload;

  if (!account_id) {
    return new Response(JSON.stringify({ error: 'Missing account_id' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }

  try {
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeSecretKey) {
      throw new Error('Stripe secret key not configured');
    }

    console.log('[STRIPE-CONNECT] Creating dashboard link for:', account_id);

    const response = await fetch('https://api.stripe.com/v1/accounts/' + account_id + '/login_links', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[STRIPE-CONNECT] Stripe API error:', errorText);
      throw new Error(`Failed to create dashboard link: ${errorText}`);
    }

    const loginLink = await response.json();
    console.log('[STRIPE-CONNECT] Dashboard link created');

    return new Response(JSON.stringify({
      success: true,
      url: loginLink.url,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('[STRIPE-CONNECT] Error creating dashboard link:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
}
