
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

  if (!credentials.tradingview_session_cookie || !credentials.tradingview_signed_session_cookie || !user_id) {
    return new Response(JSON.stringify({ error: 'Missing required credentials or user ID.' }), {
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

  const tvResponse = await fetch(testUrl, {
    headers: {
      'Cookie': `sessionid=${sessionCookie}; sessionid_sign=${signedSessionCookie}`,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    },
  });
  
  console.log(`TradingView connection test - Status: ${tvResponse.status}`);

  if (!tvResponse.ok) {
    await supabaseAdmin.from('profiles').update({ is_tradingview_connected: false, updated_at: new Date().toISOString() }).eq('id', user_id);
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
  
  // Updated check: Extract username from the <title> tag as a fallback.
  const title = doc?.querySelector('title')?.textContent;
  const usernameMatch = title?.match(/Trader (.+?) —/);
  const foundUsername = usernameMatch ? usernameMatch[1] : null;


  if (!isAuthenticated || !foundUsername) {
     await supabaseAdmin.from('profiles').update({ is_tradingview_connected: false, updated_at: new Date().toISOString() }).eq('id', user_id);
     console.error("Could not verify TradingView session. isAuthenticated:", isAuthenticated, "foundUsername:", foundUsername);
     console.error("Received HTML (first 500 chars):", html.substring(0, 500));
     return new Response(JSON.stringify({ error: `Could not verify TradingView session. Your cookies may be invalid or expired. Please get new ones from your browser.` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 401,
    });
  }

  if (tradingview_username && foundUsername.toLowerCase() !== tradingview_username.toLowerCase()) {
    await supabaseAdmin.from('profiles').update({ is_tradingview_connected: false, updated_at: new Date().toISOString() }).eq('id', user_id);
    console.error(`Username mismatch. Provided: ${tradingview_username}, Found: ${foundUsername}`);
    return new Response(JSON.stringify({ error: `Connection failed. The provided cookies belong to user '${foundUsername}', but you entered username '${tradingview_username}'. Please ensure the username and cookies match.` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 401,
    });
  }

  const encrypted_session = await encrypt(sessionCookie, key);
  const encrypted_signed_session = await encrypt(signedSessionCookie, key);

  const { error } = await supabaseAdmin
    .from('profiles')
    .update({
      tradingview_session_cookie: encrypted_session,
      tradingview_signed_session_cookie: encrypted_signed_session,
      tradingview_username: foundUsername,
      is_tradingview_connected: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user_id);

  if (error) throw error;
  
  return new Response(JSON.stringify({ message: `Connection successful! Found and saved profile for TradingView user '${foundUsername}'.` }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status: 200,
  });
}
