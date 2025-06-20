
import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../../_shared/cors.ts';
import { decrypt } from '../utils/crypto.ts';

export async function assignScriptAccess(
  payload: any,
  supabaseAdmin: SupabaseClient,
  key: CryptoKey
): Promise<Response> {
  const { pine_id, tradingview_username, assignment_id } = payload;
  
  if (!pine_id || !tradingview_username || !assignment_id) {
    return new Response(JSON.stringify({ 
      error: 'Missing required parameters: pine_id, tradingview_username, assignment_id' 
    }), {
      status: 400, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    // Get assignment details
    const { data: assignment, error: assignmentError } = await supabaseAdmin
      .from('script_assignments')
      .select(`
        *,
        profiles!seller_id (
          tradingview_session_cookie,
          tradingview_signed_session_cookie,
          is_tradingview_connected
        )
      `)
      .eq('id', assignment_id)
      .single();

    if (assignmentError || !assignment) {
      return new Response(JSON.stringify({ error: 'Assignment not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const profile = assignment.profiles;
    if (!profile?.is_tradingview_connected || !profile.tradingview_session_cookie) {
      return new Response(JSON.stringify({ 
        error: 'Seller TradingView account not connected' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Decrypt session cookies
    const sessionCookie = await decrypt(profile.tradingview_session_cookie, key);
    const signedSessionCookie = await decrypt(profile.tradingview_signed_session_cookie, key);

    // Update assignment attempt
    await supabaseAdmin
      .from('script_assignments')
      .update({
        assignment_attempts: assignment.assignment_attempts + 1,
        last_attempt_at: new Date().toISOString(),
        status: 'pending'
      })
      .eq('id', assignment_id);

    console.log(`[ASSIGN] Attempting to assign script access: pine_id=${pine_id}, username=${tradingview_username}`);

    // Step 1: Validate username exists
    console.log(`[ASSIGN] Validating username: ${tradingview_username}`);
    const usernameCheckResponse = await fetch(`https://www.tradingview.com/username_hint/?s=${encodeURIComponent(tradingview_username)}`, {
      headers: {
        'Cookie': `sessionid=${sessionCookie}; sessionid_sign=${signedSessionCookie}`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      },
    });

    console.log(`[ASSIGN] Username validation response status: ${usernameCheckResponse.status}`);

    if (!usernameCheckResponse.ok) {
      throw new Error('Failed to validate TradingView username');
    }

    const usernameData = await usernameCheckResponse.json();
    console.log(`[ASSIGN] Username validation response:`, usernameData);
    
    const userExists = usernameData.some((user: any) => 
      user.username?.toLowerCase() === tradingview_username.toLowerCase()
    );

    if (!userExists) {
      throw new Error(`TradingView username "${tradingview_username}" not found`);
    }

    console.log(`[ASSIGN] Username "${tradingview_username}" validated successfully`);

    // Step 2: Get the actual script_id (PUB;xxx format) from our database
    // Use the most recent script entry for this seller and pine_id to avoid duplicates
    console.log(`[ASSIGN] Looking up script_id for pine_id: ${pine_id}`);
    
    const { data: scriptData, error: scriptError } = await supabaseAdmin
      .from('tradingview_scripts')
      .select('script_id, pine_id')
      .eq('user_id', assignment.seller_id)
      .eq('pine_id', pine_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (scriptError) {
      console.error(`[ASSIGN] Database error looking up script:`, scriptError);
      
      // If not found by pine_id, try by script_id (in case pine_id is actually the script_id)
      if (scriptError.code === 'PGRST116') {
        console.log(`[ASSIGN] Not found by pine_id, trying by script_id`);
        const { data: scriptDataById, error: scriptErrorById } = await supabaseAdmin
          .from('tradingview_scripts')
          .select('script_id, pine_id')
          .eq('user_id', assignment.seller_id)
          .eq('script_id', pine_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (scriptErrorById) {
          throw new Error(`Database error: ${scriptErrorById.message}`);
        }
        
        if (!scriptDataById) {
          throw new Error(`Script not found with identifier: ${pine_id}`);
        }
        
        // Use the script found by script_id
        const actualScriptId = scriptDataById.script_id;
        console.log(`[ASSIGN] Found script_id: ${actualScriptId} for pine_id: ${pine_id}`);

        // Validate script_id format
        if (!actualScriptId || !actualScriptId.startsWith('PUB;')) {
          console.error(`[ASSIGN] Invalid script_id format: ${actualScriptId}`);
          throw new Error(`Invalid script_id format. Expected PUB;xxx format, got: ${actualScriptId}`);
        }

        // Continue with the assignment using scriptDataById
        return await performAssignment(
          actualScriptId, 
          scriptDataById.pine_id || pine_id, 
          tradingview_username, 
          sessionCookie, 
          signedSessionCookie, 
          assignment_id, 
          supabaseAdmin
        );
      }
      
      throw new Error(`Database error: ${scriptError.message}`);
    }

    if (!scriptData) {
      console.error(`[ASSIGN] Could not find script with pine_id: ${pine_id}`);
      throw new Error(`Script not found with pine_id: ${pine_id}`);
    }

    const actualScriptId = scriptData.script_id;
    console.log(`[ASSIGN] Found script_id: ${actualScriptId} for pine_id: ${pine_id}`);

    // Validate that we have a proper script_id format (should start with PUB;)
    if (!actualScriptId || !actualScriptId.startsWith('PUB;')) {
      console.error(`[ASSIGN] Invalid script_id format: ${actualScriptId}`);
      throw new Error(`Invalid script_id format. Expected PUB;xxx format, got: ${actualScriptId}`);
    }

    return await performAssignment(
      actualScriptId, 
      scriptData.pine_id || pine_id, 
      tradingview_username, 
      sessionCookie, 
      signedSessionCookie, 
      assignment_id, 
      supabaseAdmin
    );

  } catch (error: any) {
    console.error('[ASSIGN] Script assignment error:', error);
    
    // Update assignment as failed
    await supabaseAdmin
      .from('script_assignments')
      .update({
        status: 'failed',
        error_message: error.message,
        assignment_details: {
          pine_id,
          tradingview_username,
          error: error.message,
          failed_at: new Date().toISOString()
        }
      })
      .eq('id', assignment_id);

    return new Response(JSON.stringify({ 
      error: error.message,
      assignment_id,
      pine_id,
      tradingview_username
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
}

async function performAssignment(
  scriptId: string,
  pineId: string,
  tradingviewUsername: string,
  sessionCookie: string,
  signedSessionCookie: string,
  assignmentId: string,
  supabaseAdmin: SupabaseClient
): Promise<Response> {
  // Step 3: Add script access using the actual script_id
  console.log(`[ASSIGN] Adding script access for ${tradingviewUsername} to script_id: ${scriptId}`);

  const formData = new FormData();
  formData.append('pine_id', scriptId); // Use the actual script_id (PUB;xxx format)
  formData.append('username_recip', tradingviewUsername);
  // No expiration parameter = lifetime access

  const addAccessResponse = await fetch('https://www.tradingview.com/pine_perm/add/', {
    method: 'POST',
    headers: {
      'Cookie': `sessionid=${sessionCookie}; sessionid_sign=${signedSessionCookie}`,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Referer': `https://www.tradingview.com/script/${pineId}/`,
    },
    body: formData,
  });

  console.log(`[ASSIGN] TradingView add access response status: ${addAccessResponse.status}`);
  console.log(`[ASSIGN] TradingView add access response headers:`, Object.fromEntries(addAccessResponse.headers.entries()));

  if (!addAccessResponse.ok) {
    const errorText = await addAccessResponse.text();
    console.error('[ASSIGN] TradingView add access error response:', errorText);
    throw new Error(`Failed to add script access: ${addAccessResponse.status} - ${errorText}`);
  }

  const responseData = await addAccessResponse.json();
  console.log('[ASSIGN] TradingView add access response data:', responseData);

  // Check if the response indicates success
  let isSuccess = false;
  let message = '';

  if (responseData.status === 'ok') {
    isSuccess = true;
    message = `Successfully granted lifetime access to ${tradingviewUsername}`;
  } else if (responseData.error) {
    // Check for "user already has access" type errors which we can treat as success
    const errorMsg = responseData.error.toLowerCase();
    if (errorMsg.includes('already') || errorMsg.includes('exist')) {
      isSuccess = true;
      message = `User ${tradingviewUsername} already has access or access was granted`;
    } else {
      throw new Error(`TradingView returned an error: ${responseData.error}`);
    }
  } else {
    // If no clear success/error indicator, log for debugging
    console.log('[ASSIGN] Unclear response from TradingView, treating as success:', responseData);
    isSuccess = true;
    message = `Access request processed for ${tradingviewUsername}`;
  }

  if (isSuccess) {
    // Update assignment as successful
    await supabaseAdmin
      .from('script_assignments')
      .update({
        status: 'assigned',
        assigned_at: new Date().toISOString(),
        assignment_details: {
          pine_id: pineId,
          script_id: scriptId,
          tradingview_username: tradingviewUsername,
          response: responseData,
          assigned_at: new Date().toISOString(),
          access_type: 'lifetime'
        }
      })
      .eq('id', assignmentId);

    return new Response(JSON.stringify({ 
      success: true,
      message,
      assignment_id: assignmentId,
      pine_id: pineId,
      script_id: scriptId,
      tradingview_username: tradingviewUsername,
      access_type: 'lifetime'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });
  }

  throw new Error('Assignment failed for unknown reason');
}
