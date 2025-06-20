
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

    // Step 2: Add script access directly via the add endpoint
    console.log(`[ASSIGN] Adding script access for ${tradingview_username} to ${pine_id}`);
    
    // Create expiration date (365 days from now)
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + 365);
    const expirationString = expirationDate.toISOString().slice(0, -1).slice(0, -3) + 'Z';

    const formData = new FormData();
    formData.append('pine_id', pine_id);
    formData.append('username_recip', tradingview_username);
    formData.append('expiration', expirationString);

    const addAccessResponse = await fetch('https://www.tradingview.com/pine_perm/add/', {
      method: 'POST',
      headers: {
        'Cookie': `sessionid=${sessionCookie}; sessionid_sign=${signedSessionCookie}`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Referer': `https://www.tradingview.com/script/${pine_id}/`,
      },
      body: formData,
    });

    console.log(`[ASSIGN] TradingView add access response status: ${addAccessResponse.status}`);
    console.log(`[ASSIGN] TradingView add access response headers:`, Object.fromEntries(addAccessResponse.headers.entries()));

    if (!addAccessResponse.ok) {
      const errorText = await addAccessResponse.text();
      console.error('[ASSIGN] TradingView add access error response:', errorText);
      throw new Error(`Failed to add script access: ${addAccessResponse.status}`);
    }

    const responseData = await addAccessResponse.json();
    console.log('[ASSIGN] TradingView add access response data:', responseData);

    // Check if the response indicates success
    let isSuccess = false;
    let message = '';

    if (responseData.status === 'ok') {
      isSuccess = true;
      message = `Successfully granted access to ${tradingview_username}`;
    } else if (responseData.error) {
      // Check for "user already has access" type errors which we can treat as success
      const errorMsg = responseData.error.toLowerCase();
      if (errorMsg.includes('already') || errorMsg.includes('exist')) {
        isSuccess = true;
        message = `User ${tradingview_username} already has access or access was granted`;
      } else {
        throw new Error(`TradingView returned an error: ${responseData.error}`);
      }
    } else {
      // If no clear success/error indicator, log for debugging
      console.log('[ASSIGN] Unclear response from TradingView, treating as success:', responseData);
      isSuccess = true;
      message = `Access request processed for ${tradingview_username}`;
    }

    if (isSuccess) {
      // Update assignment as successful
      await supabaseAdmin
        .from('script_assignments')
        .update({
          status: 'assigned',
          assigned_at: new Date().toISOString(),
          assignment_details: {
            pine_id,
            tradingview_username,
            response: responseData,
            assigned_at: new Date().toISOString(),
            expiration: expirationString
          }
        })
        .eq('id', assignment_id);

      return new Response(JSON.stringify({ 
        success: true,
        message,
        assignment_id,
        pine_id,
        tradingview_username,
        expires_at: expirationString
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

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
