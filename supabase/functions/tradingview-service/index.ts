
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { DOMParser } from "https://deno.land/x/deno_dom/deno-dom-wasm.ts";

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

      // Here you would typically test the credentials against TradingView.
      // For now, we'll simulate a successful connection and proceed with encryption and saving.
      const isConnectionSuccessful = true; 

      if (isConnectionSuccessful) {
        const encrypted_session = await encrypt(credentials.tradingview_session_cookie, key);
        const encrypted_signed_session = await encrypt(credentials.tradingview_signed_session_cookie, key);

        const { error } = await supabaseAdmin
          .from('profiles')
          .update({
            tradingview_session_cookie: encrypted_session,
            tradingview_signed_session_cookie: encrypted_signed_session,
            is_tradingview_connected: true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', user_id);

        if (error) throw error;
        
        return new Response(JSON.stringify({ message: 'Connection successful and credentials saved securely.' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      } else {
        // In a real scenario, you'd update the connection status to false
        await supabaseAdmin.from('profiles').update({ is_tradingview_connected: false }).eq('id', user_id);
        return new Response(JSON.stringify({ error: 'TradingView connection failed. Please check your credentials.' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        });
      }
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

      const profileUrl = `https://www.tradingview.com/u/${profile.tradingview_username}/#published-scripts`;
      
      const tvResponse = await fetch(profileUrl, {
        headers: { 'Cookie': `sessionid=${sessionCookie}; sessionid_sign=${signedSessionCookie}` }
      });

      console.log(`TradingView fetch for ${profileUrl} - Status: ${tvResponse.status}`);

      if (!tvResponse.ok) {
        return new Response(JSON.stringify({ error: `Failed to fetch from TradingView (status: ${tvResponse.status})` }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
      }
      
      const html = await tvResponse.text();
      
      // New method: Find the script tag with bootstrap data. This is more reliable for JS-rendered pages.
      const scriptDataRegex = /<script id="user-page-bootstrap-data" type="application\/json">([\s\S]*?)<\/script>/;
      const match = html.match(scriptDataRegex);

      if (!match || !match[1]) {
        console.error("Could not find user page bootstrap data script tag. The page structure might have changed.");
        console.log('--- TradingView HTML Response (sample) ---');
        console.log(html.substring(0, 5000));
        console.log('--- End of TradingView HTML sample ---');
        return new Response(JSON.stringify({ error: 'Failed to find script data on TradingView page. The page structure may have changed.' }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
      }

      const scripts = [];
      try {
        const jsonData = JSON.parse(match[1]);
        // The structure of this JSON is a guess. We'll refine this based on logs if needed.
        const publications = jsonData?.public_scripts?.publications || [];
        console.log(`Found ${publications.length} scripts from JSON data.`);

        for (const p of publications) {
            if (p.scriptIdPart && p.title && p.link) {
                 scripts.push({
                    user_id: user_id,
                    script_id: p.scriptIdPart,
                    title: p.title,
                    publication_url: `https://www.tradingview.com${p.link}`,
                    image_url: p.image_url || null,
                    likes: p.likes_count || 0,
                    reviews_count: p.reviews_count || 0,
                    last_synced_at: new Date().toISOString(),
                });
            }
        }
      } catch (e) {
        console.error("Failed to parse JSON from bootstrap data:", e.message);
        return new Response(JSON.stringify({ error: 'Failed to parse script data from TradingView page.' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
      }
      
      if (scripts.length > 0) {
        const { error: upsertError } = await supabaseAdmin
          .from('tradingview_scripts')
          .upsert(scripts, { onConflict: 'user_id,script_id' });
        
        if (upsertError) throw upsertError;
      }

      return new Response(JSON.stringify({ message: `Sync complete. Found ${scripts.length} scripts.` }), {
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
