
import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../../_shared/cors.ts';
import { decrypt } from '../utils/crypto.ts';

export async function assignScriptAccess(
  payload: any,
  supabaseAdmin: SupabaseClient,
  key: CryptoKey
): Promise<Response> {
  const { pine_id, tradingview_username, assignment_id, access_type, trial_duration_days, subscription_expires_at } = payload;
  
  if (!pine_id || !tradingview_username || !assignment_id) {
    return new Response(JSON.stringify({ 
      error: 'Missing required parameters: pine_id, tradingview_username, assignment_id' 
    }), {
      status: 400, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    console.log(`[ASSIGN] Starting assignment process:`, {
      pine_id,
      tradingview_username,
      assignment_id,
      access_type,
      trial_duration_days,
      subscription_expires_at
    });

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
      console.error(`[ASSIGN] Assignment not found:`, assignmentError);
      return new Response(JSON.stringify({ error: 'Assignment not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[ASSIGN] Assignment details:`, {
      assignment_id: assignment.id,
      seller_id: assignment.seller_id,
      program_id: assignment.program_id,
      is_tradingview_connected: assignment.profiles?.is_tradingview_connected
    });

    const profile = assignment.profiles;
    if (!profile?.is_tradingview_connected || !profile.tradingview_session_cookie) {
      console.error(`[ASSIGN] Seller TradingView not connected:`, {
        is_connected: profile?.is_tradingview_connected,
        has_session: !!profile?.tradingview_session_cookie
      });
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

    console.log(`[ASSIGN] Session cookies decrypted successfully`);

    // Update assignment attempt
    await supabaseAdmin
      .from('script_assignments')
      .update({
        assignment_attempts: assignment.assignment_attempts + 1,
        last_attempt_at: new Date().toISOString(),
        status: 'pending'
      })
      .eq('id', assignment_id);

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
      console.error(`[ASSIGN] Username validation failed with status: ${usernameCheckResponse.status}`);
      throw new Error('Failed to validate TradingView username - possible session expired');
    }

    const usernameData = await usernameCheckResponse.json();
    console.log(`[ASSIGN] Username validation response:`, usernameData);
    
    const userExists = usernameData.some((user: any) => 
      user.username?.toLowerCase() === tradingview_username.toLowerCase()
    );

    if (!userExists) {
      console.error(`[ASSIGN] Username not found in TradingView:`, { 
        searched_username: tradingview_username,
        returned_users: usernameData.map((u: any) => u.username)
      });
      throw new Error(`TradingView username "${tradingview_username}" not found`);
    }

    console.log(`[ASSIGN] Username "${tradingview_username}" validated successfully`);

    // Step 2: Get the actual script_id (PUB;xxx format) from our database
    console.log(`[ASSIGN] Looking up script_id for pine_id: ${pine_id}`);
    
    const { data: scriptData, error: scriptError } = await supabaseAdmin
      .from('tradingview_scripts')
      .select('script_id, pine_id, title, publication_url')
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
          .select('script_id, pine_id, title, publication_url')
          .eq('user_id', assignment.seller_id)
          .eq('script_id', pine_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (scriptErrorById) {
          console.error(`[ASSIGN] Script lookup by ID also failed:`, scriptErrorById);
          throw new Error(`Database error: ${scriptErrorById.message}`);
        }
        
        if (!scriptDataById) {
          console.error(`[ASSIGN] Script not found in database:`, { 
            pine_id, 
            seller_id: assignment.seller_id 
          });
          throw new Error(`Script not found with identifier: ${pine_id}`);
        }
        
        console.log(`[ASSIGN] Found script by ID lookup:`, scriptDataById);
        return await performAssignment(
          scriptDataById.script_id, 
          scriptDataById.pine_id || pine_id, 
          tradingview_username, 
          sessionCookie, 
          signedSessionCookie, 
          assignment_id, 
          supabaseAdmin,
          access_type,
          trial_duration_days,
          scriptDataById,
          subscription_expires_at
        );
      }
      
      throw new Error(`Database error: ${scriptError.message}`);
    }

    if (!scriptData) {
      console.error(`[ASSIGN] Could not find script with pine_id: ${pine_id}`);
      throw new Error(`Script not found with pine_id: ${pine_id}`);
    }

    console.log(`[ASSIGN] Found script data:`, scriptData);

    const actualScriptId = scriptData.script_id;
    console.log(`[ASSIGN] Using script_id: ${actualScriptId} for pine_id: ${pine_id}`);

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
      supabaseAdmin,
      access_type,
      trial_duration_days,
      scriptData,
      subscription_expires_at
    );

  } catch (error: any) {
    console.error('[ASSIGN] Script assignment error:', error);
    
    // Update assignment as failed with detailed error info
    await supabaseAdmin
      .from('script_assignments')
      .update({
        status: 'failed',
        error_message: error.message,
        assignment_details: {
          pine_id,
          tradingview_username,
          access_type,
          trial_duration_days,
          error: error.message,
          error_stack: error.stack,
          failed_at: new Date().toISOString()
        }
      })
      .eq('id', assignment_id);

    return new Response(JSON.stringify({ 
      error: error.message,
      assignment_id,
      pine_id,
      tradingview_username,
      debug_info: {
        access_type,
        trial_duration_days,
        timestamp: new Date().toISOString()
      }
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
  supabaseAdmin: SupabaseClient,
  accessType?: string,
  trialDurationDays?: number,
  scriptData?: any,
  subscriptionExpiresAt?: string
): Promise<Response> {
  try {
    // Calculate expiration based on access type
    let expirationDate = null;
    if (accessType === 'trial' && trialDurationDays) {
      expirationDate = new Date(Date.now() + (trialDurationDays * 24 * 60 * 60 * 1000));
      console.log(`[ASSIGN] Setting trial expiration: ${expirationDate.toISOString()}`);
    } else if (accessType === 'subscription' && subscriptionExpiresAt) {
      expirationDate = new Date(subscriptionExpiresAt);
      console.log(`[ASSIGN] Setting subscription expiration: ${expirationDate.toISOString()}`);
    }
    // For full_purchase, expirationDate stays null = lifetime access

    // Step 3: Add script access using the actual script_id
    console.log(`[ASSIGN] Adding script access:`, {
      script_id: scriptId,
      pine_id: pineId,
      username: tradingviewUsername,
      access_type: accessType,
      trial_duration_days: trialDurationDays,
      expiration: expirationDate?.toISOString(),
      script_title: scriptData?.title
    });

    // Build multipart form data (matching Python implementation)
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
    const bodyParts = [
      `--${boundary}`,
      `Content-Disposition: form-data; name="pine_id"`,
      '',
      scriptId,
      `--${boundary}`,
      `Content-Disposition: form-data; name="username_recip"`,
      '',
      tradingviewUsername,
    ];
    
    // Add expiration for trials
    if (expirationDate) {
      bodyParts.push(
        `--${boundary}`,
        `Content-Disposition: form-data; name="expiration"`,
        '',
        expirationDate.toISOString()
      );
    }
    // For full purchases, no expiration parameter = lifetime access
    
    bodyParts.push(`--${boundary}--`);
    const body = bodyParts.join('\r\n');

    console.log(`[ASSIGN] FormData being sent to TradingView:`, {
      pine_id: scriptId,
      username_recip: tradingviewUsername,
      expiration: expirationDate?.toISOString() || 'none (lifetime access)'
    });

    const addAccessResponse = await fetch('https://www.tradingview.com/pine_perm/add/', {
      method: 'POST',
      headers: {
        'Origin': 'https://www.tradingview.com',
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Cookie': `sessionid=${sessionCookie}; sessionid_sign=${signedSessionCookie}`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.tradingview.com/',
      },
      body: body,
    });

    console.log(`[ASSIGN] TradingView add access response:`, {
      status: addAccessResponse.status,
      statusText: addAccessResponse.statusText,
      headers: Object.fromEntries(addAccessResponse.headers.entries())
    });

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
      const accessTypeText = accessType === 'trial' ? `${trialDurationDays}-day trial` : 'lifetime';
      message = `Successfully granted ${accessTypeText} access to ${tradingviewUsername}`;
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
      // Now verify the access was actually granted
      console.log(`[ASSIGN] Verifying access was granted...`);
      const verificationResult = await verifyScriptAccess(
        scriptId,
        tradingviewUsername,
        sessionCookie,
        signedSessionCookie
      );

      console.log(`[ASSIGN] Access verification result:`, verificationResult);

      // Update assignment as successful
      await supabaseAdmin
        .from('script_assignments')
        .update({
          status: 'assigned',
          assigned_at: new Date().toISOString(),
          access_type: accessType || 'full_purchase',
          expires_at: expirationDate?.toISOString() || null,
          is_trial: accessType === 'trial',
          assignment_details: {
            pine_id: pineId,
            script_id: scriptId,
            tradingview_username: tradingviewUsername,
            access_type: accessType || 'full_purchase',
            trial_duration_days: trialDurationDays,
            expires_at: expirationDate?.toISOString() || null,
            script_title: scriptData?.title,
            tradingview_response: responseData,
            verification_result: verificationResult,
            assigned_at: new Date().toISOString()
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
        access_type: accessType || 'full_purchase',
        expires_at: expirationDate?.toISOString() || null,
        trial_duration_days: trialDurationDays,
        verification: verificationResult,
        debug_info: {
          script_title: scriptData?.title,
          tradingview_response: responseData
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    throw new Error('Assignment failed for unknown reason');
  } catch (error: any) {
    console.error('[ASSIGN] Error in performAssignment:', error);
    throw error;
  }
}

// Function to verify script access was actually granted
async function verifyScriptAccess(
  scriptId: string,
  username: string,
  sessionCookie: string,
  signedSessionCookie: string
): Promise<any> {
  try {
    // Use list_users endpoint with the pine_id to check access
    const verifyResponse = await fetch('https://www.tradingview.com/pine_perm/list_users/?limit=100&order_by=-created', {
      method: 'POST',
      headers: {
        'Origin': 'https://www.tradingview.com',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': `sessionid=${sessionCookie}; sessionid_sign=${signedSessionCookie}`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      body: `pine_id=${encodeURIComponent(scriptId)}&username=${encodeURIComponent(username)}`
    });

    if (!verifyResponse.ok) {
      console.error(`[VERIFY] Access verification failed with status: ${verifyResponse.status}`);
      return {
        success: false,
        error: `Failed to verify access: ${verifyResponse.status}`,
        can_verify: false
      };
    }

    const verifyData = await verifyResponse.json();
    console.log(`[VERIFY] Access list response:`, verifyData);

    // Check if the username appears in the results
    const results = verifyData.results || verifyData;
    const hasAccess = Array.isArray(results) && results.some((accessEntry: any) => 
      accessEntry.username?.toLowerCase() === username.toLowerCase()
    );

    return {
      success: true,
      has_access: hasAccess,
      can_verify: true,
      results_count: Array.isArray(results) ? results.length : 0,
      verified_at: new Date().toISOString()
    };
  } catch (error: any) {
    console.error('[VERIFY] Error verifying script access:', error);
    return {
      success: false,
      error: error.message,
      can_verify: false
    };
  }
}
