import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { DOMParser, Element } from 'https://deno.land/x/deno_dom/deno-dom-wasm.ts';

// AES-256-GCM encryption function
async function encrypt(text: string, key: CryptoKey): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV
  const encoded = new TextEncoder().encode(text);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded
  );

  // Prepend IV to ciphertext for storage. It's needed for decryption.
  const ivAndCiphertext = new Uint8Array(iv.length + ciphertext.byteLength);
  ivAndCiphertext.set(iv);
  ivAndCiphertext.set(new Uint8Array(ciphertext), iv.length);

  // Return as a base64 string
  return btoa(String.fromCharCode(...ivAndCiphertext));
}

// AES-256-GCM decryption function
async function decrypt(encryptedText: string, key: CryptoKey): Promise<string> {
  const ivAndCiphertext = new Uint8Array(atob(encryptedText).split('').map(c => c.charCodeAt(0)));
  const iv = ivAndCiphertext.slice(0, 12);
  const ciphertext = ivAndCiphertext.slice(12);

  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );

  return new TextDecoder().decode(decryptedBuffer);
}

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

    if (action === 'test-connection') {
      const { credentials, user_id } = payload;

      if (!credentials.tradingview_session_cookie || !credentials.tradingview_signed_session_cookie || !user_id) {
        return new Response(JSON.stringify({ error: 'Missing required credentials or user ID.' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        });
      }

      // --- New, more robust Connection Test Logic ---
      const testUrl = 'https://www.tradingview.com/chart/'; // A page central to the logged-in experience
      const sessionCookie = credentials.tradingview_session_cookie;
      const signedSessionCookie = credentials.tradingview_signed_session_cookie;

      const tvResponse = await fetch(testUrl, {
        headers: {
          'Cookie': `sessionid=${sessionCookie}; sessionid_sign=${signedSessionCookie}`,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        },
        // No more 'redirect: manual'. Follow redirects normally.
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
      const body = doc?.querySelector('body');
      
      // More robust check: first confirm authentication, then get username.
      const isAuthenticated = body?.getAttribute('data-is-authenticated') === 'true';
      const tradingviewUsername = body?.getAttribute('data-username');

      if (!isAuthenticated || !tradingviewUsername) {
         await supabaseAdmin.from('profiles').update({ is_tradingview_connected: false, updated_at: new Date().toISOString() }).eq('id', user_id);
         console.error("Could not verify TradingView session. data-is-authenticated:", isAuthenticated, "data-username:", tradingviewUsername);
         return new Response(JSON.stringify({ error: `Could not verify TradingView session. Your cookies may be invalid or expired. Please get new ones from your browser.` }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        });
      }
      // --- End of New Connection Test Logic ---

      const encrypted_session = await encrypt(sessionCookie, key);
      const encrypted_signed_session = await encrypt(signedSessionCookie, key);

      const { error } = await supabaseAdmin
        .from('profiles')
        .update({
          tradingview_session_cookie: encrypted_session,
          tradingview_signed_session_cookie: encrypted_signed_session,
          tradingview_username: tradingviewUsername, // <-- Use the username from the page body
          is_tradingview_connected: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user_id);

      if (error) throw error;
      
      return new Response(JSON.stringify({ message: `Connection successful! Found and saved profile for TradingView user '${tradingviewUsername}'.` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    if (action === 'sync-user-scripts') {
      const { user_id } = payload;
      if (!user_id) {
        return new Response(JSON.stringify({ error: 'Missing user ID.' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('is_tradingview_connected, tradingview_session_cookie, tradingview_signed_session_cookie, tradingview_username')
        .eq('id', user_id)
        .single();
      
      if (profileError || !profile) {
        return new Response(JSON.stringify({ error: 'User profile not found.' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
      }
      if (!profile.is_tradingview_connected || !profile.tradingview_session_cookie || !profile.tradingview_signed_session_cookie || !profile.tradingview_username) {
        return new Response(JSON.stringify({ error: 'TradingView not connected. Please connect your account in settings.' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
      }
      
      const sessionCookie = await decrypt(profile.tradingview_session_cookie, key);
      const signedSessionCookie = await decrypt(profile.tradingview_signed_session_cookie, key);

      // New approach: Hit the data endpoint directly
      const scriptsApiUrl = `https://www.tradingview.com/publish/history/${profile.tradingview_username}/?sort=recent&page=1`;
      
      console.log(`Fetching scripts from TradingView API: ${scriptsApiUrl}`);

      const tvResponse = await fetch(scriptsApiUrl, {
        headers: { 
          'Cookie': `sessionid=${sessionCookie}; sessionid_sign=${signedSessionCookie}`,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'X-Requested-With': 'XMLHttpRequest', // Important header for API-like requests
        },
      });

      console.log(`TradingView API fetch for ${profile.tradingview_username} - Status: ${tvResponse.status}`);
      
      if (!tvResponse.ok) {
        if (tvResponse.status === 404) {
           return new Response(JSON.stringify({ error: `TradingView user '${profile.tradingview_username}' not found or has no public scripts. Please check your username or script visibility.` }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
        }
        const errorText = await tvResponse.text();
        console.error("TradingView API Error Response:", errorText);
        return new Response(JSON.stringify({ error: `Failed to fetch scripts from TradingView API (status: ${tvResponse.status})` }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
      }

      const responseData = await tvResponse.json();
      const publications = responseData.results?.publications || [];
      
      console.log(`Found ${publications.length} publications in API response.`);

      if (publications.length === 0) {
        return new Response(JSON.stringify({ message: `Sync complete. Found 0 public scripts for '${profile.tradingview_username}'.` }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }
      
      const scripts = publications.map((p: any) => ({
          user_id: user_id,
          script_id: p.script_id_name,
          title: p.name,
          publication_url: `https://www.tradingview.com${p.link}`,
          image_url: p.image_url,
          likes: p.likes_count || 0,
          reviews_count: p.reviews_count || 0,
          last_synced_at: new Date().toISOString(),
      }));
      
      if (scripts.length > 0) {
        const { error: upsertError } = await supabaseAdmin
          .from('tradingview_scripts')
          .upsert(scripts, { onConflict: 'user_id,script_id' });
        
        if (upsertError) throw upsertError;
      }

      return new Response(JSON.stringify({ message: `Sync complete. Found ${scripts.length} scripts for '${profile.tradingview_username}'.` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  } catch (error) {
    console.error('Error in tradingview-service:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
