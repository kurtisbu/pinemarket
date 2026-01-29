
import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../../_shared/cors.ts';
import { decrypt } from '../utils/crypto.ts';

export async function revokeScriptAccess(
  payload: any, 
  supabaseAdmin: SupabaseClient, 
  key: CryptoKey
): Promise<Response> {
  const { pine_id, tradingview_username, assignment_id } = payload;
  
  console.log('[REVOKE] Revoking script access...', { pine_id, tradingview_username, assignment_id });

  if (!pine_id || !tradingview_username) {
    return new Response(JSON.stringify({ 
      error: 'Missing required parameters for access revocation' 
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    // Get seller credentials for this assignment
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
      console.error('[REVOKE] Assignment not found:', assignmentError);
      return new Response(JSON.stringify({ 
        error: 'Assignment not found or access denied' 
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const sellerProfile = assignment.profiles;
    if (!sellerProfile?.tradingview_session_cookie || !sellerProfile?.tradingview_signed_session_cookie) {
      return new Response(JSON.stringify({ 
        error: 'Seller TradingView credentials not available' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Decrypt the session cookies
    const sessionCookie = await decrypt(sellerProfile.tradingview_session_cookie, key);
    const signedSessionCookie = await decrypt(sellerProfile.tradingview_signed_session_cookie, key);

    // Get the actual script_id from our database
    const { data: scriptData } = await supabaseAdmin
      .from('tradingview_scripts')
      .select('script_id')
      .eq('user_id', assignment.seller_id)
      .or(`pine_id.eq.${pine_id},script_id.eq.${pine_id}`)
      .limit(1)
      .maybeSingle();

    const actualScriptId = scriptData?.script_id || pine_id;
    console.log(`[REVOKE] Using script_id: ${actualScriptId}`);

    // Build multipart form data (matching Python implementation)
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
    const body = [
      `--${boundary}`,
      `Content-Disposition: form-data; name="pine_id"`,
      '',
      actualScriptId,
      `--${boundary}`,
      `Content-Disposition: form-data; name="username_recip"`,
      '',
      tradingview_username,
      `--${boundary}--`
    ].join('\r\n');

    // Make request to TradingView to revoke access using correct endpoint
    const revokeResponse = await fetch('https://www.tradingview.com/pine_perm/remove/', {
      method: 'POST',
      headers: {
        'Origin': 'https://www.tradingview.com',
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Cookie': `sessionid=${sessionCookie}; sessionid_sign=${signedSessionCookie}`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.tradingview.com/'
      },
      body: body
    });

    console.log(`[REVOKE] TradingView API response status: ${revokeResponse.status}`);

    if (!revokeResponse.ok) {
      const errorText = await revokeResponse.text();
      console.error('[REVOKE] TradingView API error:', errorText);
      throw new Error(`TradingView revocation failed: ${revokeResponse.status}`);
    }

    let result;
    try {
      result = await revokeResponse.json();
      console.log('[REVOKE] TradingView revocation result:', result);
    } catch {
      result = { status: 'ok' };
    }

    // Update assignment status
    await supabaseAdmin
      .from('script_assignments')
      .update({
        status: 'expired',
        assignment_details: {
          ...(assignment.assignment_details || {}),
          revoked_at: new Date().toISOString(),
          revocation_result: result
        }
      })
      .eq('id', assignment_id);

    // Log the revocation
    await supabaseAdmin
      .from('assignment_logs')
      .insert({
        assignment_id,
        purchase_id: assignment.purchase_id,
        log_level: 'info',
        message: 'TradingView access revoked successfully',
        details: {
          pine_id,
          script_id: actualScriptId,
          tradingview_username,
          revocation_result: result
        }
      });

    return new Response(JSON.stringify({
      success: true,
      message: 'Script access revoked successfully',
      details: result
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error: any) {
    console.error('[REVOKE] Error revoking script access:', error);

    // Log the error
    if (assignment_id) {
      try {
        const { data: assignment } = await supabaseAdmin
          .from('script_assignments')
          .select('purchase_id')
          .eq('id', assignment_id)
          .single();

        await supabaseAdmin
          .from('assignment_logs')
          .insert({
            assignment_id,
            purchase_id: assignment?.purchase_id || assignment_id,
            log_level: 'error',
            message: 'Failed to revoke TradingView access',
            details: {
              error: error.message,
              pine_id,
              tradingview_username
            }
          });
      } catch (logError) {
        console.warn('[REVOKE] Failed to log revocation error:', logError);
      }
    }

    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}
