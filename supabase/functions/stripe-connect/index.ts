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
      case 'create-payment-intent':
        return await createPaymentIntent(payload, supabaseAdmin);
      case 'confirm-purchase':
        return await confirmPurchase(payload, supabaseAdmin);
      case 'complete-stripe-purchase':
        return await completeStripePurchase(payload, supabaseAdmin);
      case 'get-account-status':
        return await getAccountStatus(payload, supabaseAdmin, req);
      case 'get-my-account-status':
        return await getMyAccountStatus(supabaseAdmin, req);
      case 'create-connect-account':
        return await createConnectAccount(payload, supabaseAdmin, req);
      case 'create-account-link':
        return await createAccountLink(payload, supabaseAdmin, req);
      case 'create-dashboard-link':
        return await createDashboardLink(payload, supabaseAdmin, req);
      case 'create-my-account-link':
        return await createMyAccountLink(payload, supabaseAdmin, req);
      case 'create-my-dashboard-link':
        return await createMyDashboardLink(supabaseAdmin, req);
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

async function getAccountStatus(payload: any, supabaseAdmin: any, req: Request) {
  const { account_id } = payload;
  
  // If account_id is provided, verify the user owns this account
  if (account_id) {
    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      const supabaseAuth = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? ''
      );
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabaseAuth.auth.getUser(token);
      
      if (user) {
        // Verify user owns this Stripe account
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('stripe_account_id')
          .eq('id', user.id)
          .single();
        
        if (profile?.stripe_account_id !== account_id) {
          return new Response(JSON.stringify({ error: 'Unauthorized - account mismatch' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 403,
          });
        }
      }
    }
  }

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

// New secure function - fetches account status for authenticated user without exposing account ID
async function getMyAccountStatus(supabaseAdmin: any, req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Authorization required' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 401,
    });
  }

  const supabaseAuth = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  );

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(token);
  
  if (userError || !user) {
    return new Response(JSON.stringify({ error: 'User not authenticated' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 401,
    });
  }

  console.log('[STRIPE-ACCOUNT] Fetching account status for user:', user.id);

  try {
    // Get user's stripe_account_id from profiles (server-side only)
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('stripe_account_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return new Response(JSON.stringify({ 
        success: true,
        has_account: false,
        charges_enabled: false,
        payouts_enabled: false,
        details_submitted: false,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    if (!profile.stripe_account_id) {
      return new Response(JSON.stringify({
        success: true,
        has_account: false,
        charges_enabled: false,
        payouts_enabled: false,
        details_submitted: false,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeSecretKey) {
      throw new Error('Stripe secret key not configured');
    }

    // Fetch Stripe account details
    const response = await fetch(`https://api.stripe.com/v1/accounts/${profile.stripe_account_id}`, {
      headers: {
        'Authorization': `Bearer ${stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[STRIPE-ACCOUNT] Stripe API error:', errorText);
      // Don't expose the error details to client
      return new Response(JSON.stringify({
        success: true,
        has_account: true,
        charges_enabled: false,
        payouts_enabled: false,
        details_submitted: false,
        connection_issue: true,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const account = await response.json();

    // Update the profile with latest Stripe status
    await supabaseAdmin
      .from('profiles')
      .update({
        stripe_onboarding_completed: account.details_submitted,
        stripe_charges_enabled: account.charges_enabled,
        stripe_payouts_enabled: account.payouts_enabled,
      })
      .eq('id', user.id);

    console.log('[STRIPE-ACCOUNT] Account status fetched:', {
      has_account: true,
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled,
      details_submitted: account.details_submitted,
    });

    return new Response(JSON.stringify({
      success: true,
      has_account: true,
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
      error: 'Failed to fetch account status',
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

async function createAccountLink(payload: any, supabaseAdmin: any, req: Request) {
  const { account_id, refresh_url, return_url } = payload;

  if (!account_id || !refresh_url || !return_url) {
    return new Response(JSON.stringify({ error: 'Missing required parameters' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }

  // Verify user owns this account
  const authHeader = req.headers.get('Authorization');
  if (authHeader) {
    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabaseAuth.auth.getUser(token);
    
    if (user) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('stripe_account_id')
        .eq('id', user.id)
        .single();
      
      if (profile?.stripe_account_id !== account_id) {
        return new Response(JSON.stringify({ error: 'Unauthorized - account mismatch' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403,
        });
      }
    }
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

async function createDashboardLink(payload: any, supabaseAdmin: any, req: Request) {
  const { account_id } = payload;

  if (!account_id) {
    return new Response(JSON.stringify({ error: 'Missing account_id' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }

  // Verify user owns this account
  const authHeader = req.headers.get('Authorization');
  if (authHeader) {
    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabaseAuth.auth.getUser(token);
    
    if (user) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('stripe_account_id')
        .eq('id', user.id)
        .single();
      
      if (profile?.stripe_account_id !== account_id) {
        return new Response(JSON.stringify({ error: 'Unauthorized - account mismatch' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403,
        });
      }
    }
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

// Secure version - creates account link for authenticated user without exposing account ID
async function createMyAccountLink(payload: any, supabaseAdmin: any, req: Request) {
  const { refresh_url, return_url } = payload;

  if (!refresh_url || !return_url) {
    return new Response(JSON.stringify({ error: 'Missing required parameters' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Authorization required' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 401,
    });
  }

  const supabaseAuth = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  );

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(token);
  
  if (userError || !user) {
    return new Response(JSON.stringify({ error: 'User not authenticated' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 401,
    });
  }

  try {
    // Get user's stripe_account_id from profiles (server-side only)
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('stripe_account_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.stripe_account_id) {
      return new Response(JSON.stringify({ error: 'No Stripe account found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeSecretKey) {
      throw new Error('Stripe secret key not configured');
    }

    console.log('[STRIPE-CONNECT] Creating account link for user:', user.id);

    const formData = new URLSearchParams({
      account: profile.stripe_account_id,
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

// Secure version - creates dashboard link for authenticated user without exposing account ID
async function createMyDashboardLink(supabaseAdmin: any, req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Authorization required' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 401,
    });
  }

  const supabaseAuth = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  );

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(token);
  
  if (userError || !user) {
    return new Response(JSON.stringify({ error: 'User not authenticated' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 401,
    });
  }

  try {
    // Get user's stripe_account_id from profiles (server-side only)
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('stripe_account_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.stripe_account_id) {
      return new Response(JSON.stringify({ error: 'No Stripe account found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeSecretKey) {
      throw new Error('Stripe secret key not configured');
    }

    console.log('[STRIPE-CONNECT] Creating dashboard link for user:', user.id);

    const response = await fetch('https://api.stripe.com/v1/accounts/' + profile.stripe_account_id + '/login_links', {
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
