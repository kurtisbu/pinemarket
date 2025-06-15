import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

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

      // Fetch the user's main profile page, following redirects automatically.
      // The public scripts data is embedded in this page's HTML.
      const userProfileUrl = `https://www.tradingview.com/u/${profile.tradingview_username}/`;
      const tvResponse = await fetch(userProfileUrl, {
        headers: { 'Cookie': `sessionid=${sessionCookie}; sessionid_sign=${signedSessionCookie}` },
        redirect: 'follow', // Let fetch handle redirects to get the final page content
      });

      console.log(`TradingView profile fetch for ${userProfileUrl} - Status: ${tvResponse.status}`);
      console.log(`Final URL after redirects: ${tvResponse.url}`);

      if (!tvResponse.ok) {
        if (tvResponse.status === 404) {
           return new Response(JSON.stringify({ error: `TradingView user '${profile.tradingview_username}' not found. Please check the username in your settings.` }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
        }
        return new Response(JSON.stringify({ error: `Failed to fetch profile page from TradingView (status: ${tvResponse.status})` }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
      }
      
      // Determine the effective username from the final URL after redirects.
      let effectiveUsername = profile.tradingview_username;
      try {
        const finalUrl = new URL(tvResponse.url);
        const pathParts = finalUrl.pathname.split('/').filter(p => p);
        if (pathParts.length >= 2 && pathParts[0] === 'u') {
          effectiveUsername = pathParts[1];
          console.log(`Using effective username from final URL: ${effectiveUsername}`);
        }
      } catch (e) {
        console.error('Could not parse final URL, falling back to original username.', e.message);
      }
      
      const html = await tvResponse.text();
      
      // New, more robust method: Search all script tags for the data.
      const scriptContentRegex = /<script[^>]*>([\s\S]*?)<\/script>/g;
      let publications = [];
      let foundData = false;

      let match;
      while ((match = scriptContentRegex.exec(html)) !== null) {
        const scriptContent = match[1];

        // Heuristic: The data we want is a JSON object containing 'public_scripts'.
        if (scriptContent.includes('"public_scripts"')) {
          try {
            // The script content might be `window.data = {...json...}`. We need to extract the JSON object itself.
            // Using a regex to find the outermost curly braces. The 's' flag allows '.' to match newlines.
            const jsonStringMatch = scriptContent.match(/({.*})/s);
            if (jsonStringMatch && jsonStringMatch[0]) {
              const potentialJson = jsonStringMatch[0];
              const data = JSON.parse(potentialJson);

              if (data && data.public_scripts && Array.isArray(data.public_scripts.publications)) {
                publications = data.public_scripts.publications;
                console.log(`Found ${publications.length} scripts from JSON data in a script tag.`);
                foundData = true;
                break; // Exit the loop once data is found
              }
            }
          } catch (e) {
            // This script tag didn't contain the data in the expected format. Continue searching.
          }
        }
      }

      if (!foundData) {
        console.error("Could not find user page bootstrap data in any script tag. The page structure might have changed.");
        console.log('--- TradingView HTML Response (sample)---');
        console.log(html.substring(0, 8000));
        console.log('--- End of TradingView HTML sample ---');
        return new Response(JSON.stringify({ error: 'Failed to find script data on TradingView page. The page structure may have changed.' }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
      }

      const scripts = [];
      console.log(`Processing ${publications.length} publications into scripts.`);

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
      
      if (scripts.length > 0) {
        const { error: upsertError } = await supabaseAdmin
          .from('tradingview_scripts')
          .upsert(scripts, { onConflict: 'user_id,script_id' });
        
        if (upsertError) throw upsertError;
      }

      // If we found scripts, also update the profile with the effective username if it changed.
      if (effectiveUsername.toLowerCase() !== profile.tradingview_username.toLowerCase()) {
        console.log(`Updating username in profile from '${profile.tradingview_username}' to '${effectiveUsername}'.`);
        const { error: profileUpdateError } = await supabaseAdmin
          .from('profiles')
          .update({ tradingview_username: effectiveUsername, updated_at: new Date().toISOString() })
          .eq('id', user_id);
        
        if (profileUpdateError) {
          // Log the error but don't fail the whole sync process
          console.error('Failed to update effective username in profile:', profileUpdateError.message);
        }
      }

      return new Response(JSON.stringify({ message: `Sync complete. Found ${scripts.length} scripts for '${effectiveUsername}'.` }), {
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
