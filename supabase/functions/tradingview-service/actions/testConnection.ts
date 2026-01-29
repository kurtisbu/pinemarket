
import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { DOMParser } from 'https://deno.land/x/deno_dom/deno-dom-wasm.ts';
import { corsHeaders } from '../../_shared/cors.ts';
import { encrypt } from '../utils/crypto.ts';

export async function testConnection(
  payload: any,
  supabaseAdmin: SupabaseClient,
  key: CryptoKey
): Promise<Response> {
  const { credentials, user_id, tradingview_username } = payload;

  console.log('[TEST-CONNECTION] Validating payload:', {
    has_credentials: !!credentials,
    has_session_cookie: !!credentials?.tradingview_session_cookie,
    has_signed_cookie: !!credentials?.tradingview_signed_session_cookie,
    has_user_id: !!user_id,
    tradingview_username
  });

  if (!credentials || !credentials.tradingview_session_cookie || !credentials.tradingview_signed_session_cookie || !user_id) {
    console.error('[TEST-CONNECTION] Missing required parameters:', payload);
    return new Response(JSON.stringify({ 
      error: 'Missing required credentials or user ID.',
      details: {
        has_credentials: !!credentials,
        has_session_cookie: !!credentials?.tradingview_session_cookie,
        has_signed_cookie: !!credentials?.tradingview_signed_session_cookie,
        has_user_id: !!user_id
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }

  const testUrl = tradingview_username
    ? `https://www.tradingview.com/u/${tradingview_username}/#settings-profile`
    : 'https://www.tradingview.com/chart/';
  
  console.log(`Attempting TradingView connection test at: ${testUrl}`);
  
  const sessionCookie = credentials.tradingview_session_cookie;
  const signedSessionCookie = credentials.tradingview_signed_session_cookie;

  try {
    const tvResponse = await fetch(testUrl, {
      headers: {
        'Cookie': `sessionid=${sessionCookie}; sessionid_sign=${signedSessionCookie}`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      },
    });
    
    console.log(`TradingView connection test - Status: ${tvResponse.status}`);

    if (!tvResponse.ok) {
      // Update connection status to expired/error
      await supabaseAdmin.from('profiles').update({ 
        is_tradingview_connected: false,
        tradingview_connection_status: 'expired',
        tradingview_last_validated_at: new Date().toISOString(),
        tradingview_last_error: `HTTP ${tvResponse.status}: Connection failed`,
        updated_at: new Date().toISOString() 
      }).eq('id', user_id);

      const errorText = await tvResponse.text();
      console.error("TradingView Connection Test Error:", errorText.substring(0, 500));
      return new Response(JSON.stringify({ error: `TradingView connection failed. Please check your session cookies. (Status: ${tvResponse.status})` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }
    
    const html = await tvResponse.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    
    // Updated check: Look for 'is-authenticated' class on the <html> tag.
    const isAuthenticated = doc?.querySelector('html')?.classList.contains('is-authenticated');
    
    // Enhanced username extraction with multiple fallback methods
    let foundUsername = null;
    
    // Method 1: Extract from title tag - handle multiple formats
    const title = doc?.querySelector('title')?.textContent;
    if (title) {
      // Try different title patterns
      const titlePatterns = [
        /^([^—]+)\s*—\s*Trading Ideas and Scripts/,  // "CapitalCodersLLC — Trading Ideas and Scripts"
        /^([^—]+)\s*—\s*TradingView/,                // "CapitalCodersLLC — TradingView"
        /Trader\s+([^—\s]+)/,                        // "Trader USERNAME"
        /^([^—\s]+)/                                 // First word before any separator
      ];
      
      for (const pattern of titlePatterns) {
        const match = title.match(pattern);
        if (match && match[1]) {
          foundUsername = match[1].trim();
          break;
        }
      }
    }
    
    // Method 2: If we have a provided username and title contains it, use it
    if (!foundUsername && tradingview_username && title?.toLowerCase().includes(tradingview_username.toLowerCase())) {
      foundUsername = tradingview_username;
    }
    
    // Method 3: Look for username in meta tags or data attributes
    if (!foundUsername) {
      const metaDescription = doc?.querySelector('meta[name="description"]')?.getAttribute('content');
      if (metaDescription) {
        const descMatch = metaDescription.match(/View\s+([^'s\s]+)'?s?\s+trading/i);
        if (descMatch && descMatch[1]) {
          foundUsername = descMatch[1];
        }
      }
    }
    
    console.log(`Authentication check - isAuthenticated: ${isAuthenticated}, foundUsername: ${foundUsername}, title: ${title}`);

    if (!isAuthenticated) {
      // Update connection status to expired
      await supabaseAdmin.from('profiles').update({ 
        is_tradingview_connected: false,
        tradingview_connection_status: 'expired',
        tradingview_last_validated_at: new Date().toISOString(),
        tradingview_last_error: 'Authentication failed - cookies may be expired',
        updated_at: new Date().toISOString() 
      }).eq('id', user_id);

      console.error("Could not verify TradingView session. isAuthenticated:", isAuthenticated);
      return new Response(JSON.stringify({ error: `Could not verify TradingView session. Your cookies may be invalid or expired. Please get new ones from your browser.` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    // If we couldn't extract username but have authentication, try to use provided username
    if (!foundUsername && tradingview_username) {
      console.log(`Using provided username since extraction failed: ${tradingview_username}`);
      foundUsername = tradingview_username;
    }

    // If we still don't have a username, that's an error
    if (!foundUsername) {
      await supabaseAdmin.from('profiles').update({ 
        is_tradingview_connected: false,
        tradingview_connection_status: 'error',
        tradingview_last_validated_at: new Date().toISOString(),
        tradingview_last_error: 'Could not extract username from TradingView profile',
        updated_at: new Date().toISOString() 
      }).eq('id', user_id);

      console.error("Could not extract username from TradingView profile");
      console.error("Received HTML (first 500 chars):", html.substring(0, 500));
      return new Response(JSON.stringify({ error: `Could not extract your TradingView username from the profile page. Please ensure you're logged into TradingView and try again.` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    // Validate username match if one was provided
    if (tradingview_username && foundUsername.toLowerCase() !== tradingview_username.toLowerCase()) {
      // Update connection status to error
      await supabaseAdmin.from('profiles').update({ 
        is_tradingview_connected: false,
        tradingview_connection_status: 'error',
        tradingview_last_validated_at: new Date().toISOString(),
        tradingview_last_error: `Username mismatch: expected ${tradingview_username}, found ${foundUsername}`,
        updated_at: new Date().toISOString() 
      }).eq('id', user_id);

      console.error(`Username mismatch. Provided: ${tradingview_username}, Found: ${foundUsername}`);
      return new Response(JSON.stringify({ error: `Connection failed. The provided cookies belong to user '${foundUsername}', but you entered username '${tradingview_username}'. Please ensure the username and cookies match.` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    // Check if this TradingView username is already connected to another user
    const { data: existingConnection } = await supabaseAdmin
      .from('profiles')
      .select('id, display_name, username')
      .eq('tradingview_username', foundUsername)
      .eq('is_tradingview_connected', true)
      .neq('id', user_id)
      .single();

    if (existingConnection) {
      console.log(`TradingView account ${foundUsername} is already connected to user ${existingConnection.id}`);
      
      await supabaseAdmin
        .from('profiles')
        .update({
          tradingview_connection_status: 'error',
          tradingview_last_error: `This TradingView account is already connected to another user`,
          is_tradingview_connected: false,
        })
        .eq('id', user_id);

      return new Response(
        JSON.stringify({
          error: `This TradingView account (${foundUsername}) is already connected to another user. Please disconnect it from the other account first, or use a different TradingView account.`,
          errorCode: 'TRADINGVIEW_ALREADY_CONNECTED',
          connectedUsername: foundUsername,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    const encrypted_session = await encrypt(sessionCookie, key);
    const encrypted_signed_session = await encrypt(signedSessionCookie, key);

    // Update profile with successful connection and health status
    const { error } = await supabaseAdmin
      .from('profiles')
      .update({
        tradingview_session_cookie: encrypted_session,
        tradingview_signed_session_cookie: encrypted_signed_session,
        tradingview_username: foundUsername,
        is_tradingview_connected: true,
        tradingview_connection_status: 'active',
        tradingview_last_validated_at: new Date().toISOString(),
        tradingview_last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user_id);

    if (error) throw error;

    // Create notification preferences if they don't exist
    await supabaseAdmin
      .from('seller_notifications')
      .upsert({
        user_id: user_id,
        email_on_connection_expiry: true,
        email_on_program_disabled: true,
      }, { onConflict: 'user_id' });
    
    return new Response(JSON.stringify({ message: `Connection successful! Found and saved profile for TradingView user '${foundUsername}'.` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Connection test error:', error);
    
    // Update connection status to error
    await supabaseAdmin.from('profiles').update({ 
      is_tradingview_connected: false,
      tradingview_connection_status: 'error',
      tradingview_last_validated_at: new Date().toISOString(),
      tradingview_last_error: error.message,
      updated_at: new Date().toISOString() 
    }).eq('id', user_id);

    return new Response(JSON.stringify({ error: 'Connection test failed due to network error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
}
