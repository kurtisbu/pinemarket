
export async function revokeScriptAccess(payload: any, supabaseAdmin: any, key: CryptoKey) {
  const { pine_id, tradingview_username, assignment_id } = payload;
  
  console.log('[REVOKE] Revoking script access...', { pine_id, tradingview_username, assignment_id });

  if (!pine_id || !tradingview_username) {
    throw new Error('Missing required parameters for access revocation');
  }

  try {
    // Get seller credentials for this assignment
    const { data: assignment, error: assignmentError } = await supabaseAdmin
      .from('script_assignments')
      .select(`
        *,
        programs!inner(
          seller_id,
          profiles!inner(
            tradingview_session_cookie,
            tradingview_signed_session_cookie
          )
        )
      `)
      .eq('id', assignment_id)
      .single();

    if (assignmentError || !assignment) {
      throw new Error('Assignment not found or access denied');
    }

    const sellerProfile = assignment.programs.profiles;
    if (!sellerProfile.tradingview_session_cookie || !sellerProfile.tradingview_signed_session_cookie) {
      throw new Error('Seller TradingView credentials not available');
    }

    // Decrypt the session cookies
    const sessionCookie = await decryptData(sellerProfile.tradingview_session_cookie, key);
    const signedSessionCookie = await decryptData(sellerProfile.tradingview_signed_session_cookie, key);

    // Make request to TradingView to revoke access
    const revokeResponse = await fetch(`https://www.tradingview.com/pine_perm/remove_user_from_script/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': `sessionid=${sessionCookie}; sessionid_sign=${signedSessionCookie}`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.tradingview.com/',
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: new URLSearchParams({
        'pine_id': pine_id,
        'username_recip': tradingview_username
      })
    });

    if (!revokeResponse.ok) {
      const errorText = await revokeResponse.text();
      console.error('[REVOKE] TradingView API error:', errorText);
      throw new Error(`TradingView revocation failed: ${revokeResponse.status}`);
    }

    const result = await revokeResponse.json();
    console.log('[REVOKE] TradingView revocation result:', result);

    // Log the revocation
    const { error: logError } = await supabaseAdmin
      .from('assignment_logs')
      .insert({
        assignment_id,
        purchase_id: assignment.purchase_id,
        log_level: 'info',
        message: 'TradingView access revoked successfully',
        details: {
          pine_id,
          tradingview_username,
          revocation_result: result
        }
      });

    if (logError) {
      console.warn('[REVOKE] Failed to log revocation:', logError);
    }

    return {
      success: true,
      message: 'Script access revoked successfully',
      details: result
    };

  } catch (error) {
    console.error('[REVOKE] Error revoking script access:', error);

    // Log the error
    try {
      await supabaseAdmin
        .from('assignment_logs')
        .insert({
          assignment_id,
          purchase_id: assignment?.purchase_id || null,
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

    throw error;
  }
}

async function decryptData(encryptedData: string, key: CryptoKey): Promise<string> {
  try {
    const parts = encryptedData.split(':');
    if (parts.length !== 2) {
      throw new Error('Invalid encrypted data format');
    }

    const iv = new Uint8Array(atob(parts[0]).split('').map(char => char.charCodeAt(0)));
    const encrypted = new Uint8Array(atob(parts[1]).split('').map(char => char.charCodeAt(0)));

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      encrypted
    );

    return new TextDecoder().decode(decrypted);
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt data');
  }
}
