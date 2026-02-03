
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { testConnection } from './actions/testConnection.ts';
import { syncUserScripts } from './actions/syncUserScripts.ts';
import { assignScriptAccess } from './actions/assignScriptAccess.ts';
import { revokeScriptAccess } from './actions/revokeScriptAccess.ts';
import { disconnectTradingView } from './actions/disconnectTradingView.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Missing or invalid authorization header' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const token = authHeader.replace('Bearer ', '');
    
    // Check if this is a service-to-service call using the service role key
    const isServiceCall = token === serviceRoleKey;
    let authenticatedUserId: string | null = null;
    
    if (isServiceCall) {
      console.log('[AUTH] Service-to-service call detected');
    } else {
      // Verify the JWT token and get the authenticated user
      const { data: claimsData, error: claimsError } = await supabaseAdmin.auth.getUser(token);
      
      if (claimsError || !claimsData?.user) {
        console.error('[AUTH] Token verification failed:', claimsError?.message);
        return new Response(
          JSON.stringify({ error: 'Unauthorized: Invalid token' }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 401,
          }
        );
      }

      authenticatedUserId = claimsData.user.id;
      console.log('[AUTH] Authenticated user:', authenticatedUserId);
    }

    const { action, ...payload } = await req.json();

    // For user-specific actions, require a real user (not service call) unless explicitly allowed
    const userSpecificActions = ['test-connection', 'sync-user-scripts', 'disconnect-tradingview'];
    if (userSpecificActions.includes(action)) {
      if (isServiceCall) {
        return new Response(
          JSON.stringify({ error: 'Forbidden: This action requires user authentication' }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 403,
          }
        );
      }
      if (payload.user_id && payload.user_id !== authenticatedUserId) {
        console.error('[AUTH] User ID mismatch:', payload.user_id, '!==', authenticatedUserId);
        return new Response(
          JSON.stringify({ error: 'Forbidden: You can only perform this action for your own account' }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 403,
          }
        );
      }
      // Override payload.user_id with authenticated user ID for safety
      payload.user_id = authenticatedUserId;
    }

    // For assign-script-access and revoke-script-access:
    // - Service calls are allowed (server-to-server from webhook)
    // - User calls require seller verification
    const sellerActions = ['assign-script-access', 'revoke-script-access'];
    if (sellerActions.includes(action) && !isServiceCall) {
      // User call - verify the authenticated user is the seller or admin
      if (payload.seller_id && payload.seller_id !== authenticatedUserId) {
        // Check if user is admin
        const { data: isAdmin } = await supabaseAdmin.rpc('has_role', { 
          _user_id: authenticatedUserId, 
          _role: 'admin' 
        });
        
        if (!isAdmin) {
          console.error('[AUTH] Non-admin attempting seller action for another user');
          return new Response(
            JSON.stringify({ error: 'Forbidden: You can only manage your own script assignments' }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 403,
            }
          );
        }
      }
    }
    
    const encryptionKeyString = Deno.env.get('TRADINGVIEW_ENCRYPTION_KEY');
    if (!encryptionKeyString) {
      throw new Error('TRADINGVIEW_ENCRYPTION_KEY is not set.');
    }

    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(encryptionKeyString),
      'AES-GCM',
      true,
      ['encrypt', 'decrypt']
    );

    switch (action) {
      case 'test-connection':
        return await testConnection(payload, supabaseAdmin, key);
      case 'sync-user-scripts':
        return await syncUserScripts(payload, supabaseAdmin, key);
      case 'assign-script-access':
        return await assignScriptAccess(payload, supabaseAdmin, key);
      case 'revoke-script-access':
        return await revokeScriptAccess(payload, supabaseAdmin, key);
      case 'disconnect-tradingview':
        return await disconnectTradingView(payload, supabaseAdmin);
      default:
        return new Response(JSON.stringify({ error: 'Invalid action.' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        });
    }
  } catch (error) {
    console.error('Error in tradingview-service:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
