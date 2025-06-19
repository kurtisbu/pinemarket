
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

    console.log(`[DIAGNOSTIC] Attempting to assign script access: pine_id=${pine_id}, username=${tradingview_username}`);

    // Step 1: Get CSRF token by fetching the script page
    const scriptUrl = `https://www.tradingview.com/script/${pine_id}/`;
    console.log(`[DIAGNOSTIC] Fetching script page: ${scriptUrl}`);
    
    const scriptPageResponse = await fetch(scriptUrl, {
      headers: {
        'Cookie': `sessionid=${sessionCookie}; sessionid_sign=${signedSessionCookie}`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      },
    });

    console.log(`[DIAGNOSTIC] Script page response status: ${scriptPageResponse.status}`);
    console.log(`[DIAGNOSTIC] Script page response headers:`, Object.fromEntries(scriptPageResponse.headers.entries()));

    if (!scriptPageResponse.ok) {
      throw new Error(`Failed to fetch script page: ${scriptPageResponse.status}`);
    }

    const scriptPageHtml = await scriptPageResponse.text();
    console.log(`[DIAGNOSTIC] Script page HTML length: ${scriptPageHtml.length}`);
    
    // Log the first 1000 characters to see the structure
    console.log(`[DIAGNOSTIC] Script page HTML start (first 1000 chars):`);
    console.log(scriptPageHtml.substring(0, 1000));
    
    // Log around where we expect to find the CSRF token
    const csrfSearchArea = scriptPageHtml.substring(0, 5000);
    console.log(`[DIAGNOSTIC] Searching for CSRF token in first 5000 chars:`);
    console.log(csrfSearchArea);
    
    // Try multiple CSRF token patterns
    const csrfPatterns = [
      /name="csrfmiddlewaretoken"\s+value="([^"]+)"/,
      /name='csrfmiddlewaretoken'\s+value='([^']+)'/,
      /"csrfmiddlewaretoken"\s*:\s*"([^"]+)"/,
      /'csrfmiddlewaretoken'\s*:\s*'([^']+)'/,
      /csrfmiddlewaretoken['"]\s*[:]?\s*['"]\s*([^'"]+)/,
      /csrf[_-]?token['"]\s*[:]?\s*['"]\s*([^'"]+)/i,
    ];

    let csrfToken = null;
    let matchedPattern = null;

    for (let i = 0; i < csrfPatterns.length; i++) {
      const pattern = csrfPatterns[i];
      const match = scriptPageHtml.match(pattern);
      if (match) {
        csrfToken = match[1];
        matchedPattern = i;
        console.log(`[DIAGNOSTIC] Found CSRF token using pattern ${i}: ${csrfToken}`);
        break;
      }
    }

    if (!csrfToken) {
      // Log more detailed info about what we found
      console.log(`[DIAGNOSTIC] No CSRF token found with any pattern. Searching for 'csrf' in HTML:`);
      const csrfMatches = scriptPageHtml.match(/csrf[^>]*>/gi);
      if (csrfMatches) {
        console.log(`[DIAGNOSTIC] Found potential CSRF elements:`, csrfMatches);
      }
      
      // Look for any input elements
      const inputMatches = scriptPageHtml.match(/<input[^>]*>/gi);
      if (inputMatches) {
        console.log(`[DIAGNOSTIC] Found input elements (first 10):`, inputMatches.slice(0, 10));
      }
      
      // Look for any meta tags that might contain CSRF
      const metaMatches = scriptPageHtml.match(/<meta[^>]*csrf[^>]*>/gi);
      if (metaMatches) {
        console.log(`[DIAGNOSTIC] Found meta CSRF elements:`, metaMatches);
      }
      
      throw new Error('Could not find CSRF token in script page');
    }

    console.log(`[DIAGNOSTIC] Successfully extracted CSRF token using pattern ${matchedPattern}: ${csrfToken.substring(0, 10)}...`);

    // Step 2: Validate username exists
    console.log(`[DIAGNOSTIC] Validating username: ${tradingview_username}`);
    const usernameCheckResponse = await fetch(`https://www.tradingview.com/username_hint/?s=${encodeURIComponent(tradingview_username)}`, {
      headers: {
        'Cookie': `sessionid=${sessionCookie}; sessionid_sign=${signedSessionCookie}`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      },
    });

    console.log(`[DIAGNOSTIC] Username validation response status: ${usernameCheckResponse.status}`);

    if (!usernameCheckResponse.ok) {
      throw new Error('Failed to validate TradingView username');
    }

    const usernameData = await usernameCheckResponse.json();
    console.log(`[DIAGNOSTIC] Username validation response:`, usernameData);
    
    const userExists = usernameData.some((user: any) => 
      user.username?.toLowerCase() === tradingview_username.toLowerCase()
    );

    if (!userExists) {
      throw new Error(`TradingView username "${tradingview_username}" not found`);
    }

    console.log(`[DIAGNOSTIC] Username "${tradingview_username}" validated successfully`);

    // Step 3: Add script access
    console.log(`[DIAGNOSTIC] Adding script access for ${tradingview_username} to ${pine_id}`);
    const formData = new FormData();
    formData.append('csrfmiddlewaretoken', csrfToken);
    formData.append('pine_id', pine_id);
    formData.append('username', tradingview_username);

    const addAccessResponse = await fetch('https://www.tradingview.com/pine_perm/add/', {
      method: 'POST',
      headers: {
        'Cookie': `sessionid=${sessionCookie}; sessionid_sign=${signedSessionCookie}`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Referer': scriptUrl,
      },
      body: formData,
    });

    console.log(`[DIAGNOSTIC] TradingView add access response status: ${addAccessResponse.status}`);
    console.log(`[DIAGNOSTIC] TradingView add access response headers:`, Object.fromEntries(addAccessResponse.headers.entries()));

    if (!addAccessResponse.ok) {
      const errorText = await addAccessResponse.text();
      console.error('[DIAGNOSTIC] TradingView add access error response:', errorText);
      throw new Error(`Failed to add script access: ${addAccessResponse.status}`);
    }

    const responseData = await addAccessResponse.json();
    console.log('[DIAGNOSTIC] TradingView add access response data:', responseData);

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
          csrf_pattern_used: matchedPattern
        }
      })
      .eq('id', assignment_id);

    return new Response(JSON.stringify({ 
      success: true,
      message: `Successfully granted access to ${tradingview_username}`,
      assignment_id,
      pine_id,
      tradingview_username,
      debug_info: {
        csrf_pattern_used: matchedPattern,
        csrf_token_length: csrfToken.length
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error: any) {
    console.error('[DIAGNOSTIC] Script assignment error:', error);
    
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
          failed_at: new Date().toISOString(),
          diagnostic_run: true
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
