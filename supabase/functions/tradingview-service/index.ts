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
      const userProfileUrl = `https://www.tradingview.com/u/${profile.tradingview_username}/#published-scripts`;
      const tvResponse = await fetch(userProfileUrl, {
        headers: { 'Cookie': `sessionid=${sessionCookie}; sessionid_sign=${signedSessionCookie}` },
        redirect: 'follow',
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
      
      // New logic: Parse the HTML and look for script widgets by class name.
      const document = new DOMParser().parseFromString(html, 'text/html');
      if (!document) {
        return new Response(JSON.stringify({ error: 'Failed to parse TradingView page HTML.' }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
      }

      const scriptElements = document.querySelectorAll('.tv-widget-idea');
      console.log(`Found ${scriptElements.length} elements with class .tv-widget-idea`);

      if (scriptElements.length === 0) {
        console.error("Could not find any '.tv-widget-idea' elements. The page structure might have changed.");
        console.log('--- TradingView HTML Response (sample)---');
        console.log(html.substring(0, 8000));
        console.log('--- End of TradingView HTML sample ---');
        return new Response(JSON.stringify({ error: 'Failed to find any scripts on the page using class "tv-widget-idea". The page structure may have changed.' }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
      }
      
      const scripts = [];
      console.log(`Processing ${scriptElements.length} publications into scripts.`);

      for (const p of scriptElements) {
          const element = p as Element;
          
          const titleElement = element.querySelector('.tv-widget-idea__title');
          const title = titleElement?.textContent?.trim() || 'Untitled';
          const link = titleElement?.getAttribute('href');
          
          if (!link) continue; // Skip if there's no link to the publication

          const publication_url = `https://www.tradingview.com${link}`;
          
          // The scriptIdPart is the unique part of the URL path for the script
          const scriptIdPart = link.split('/').filter(part => part).pop() || null;

          const imageElement = element.querySelector('.tv-widget-idea__cover img');
          const image_url = imageElement?.getAttribute('src') || null;
          
          const socialStats = element.querySelectorAll('.tv-social-stats__count');
          const likes = socialStats[0] ? parseInt(socialStats[0].textContent?.trim() || '0', 10) : 0;
          const reviews_count = socialStats[1] ? parseInt(socialStats[1].textContent?.trim() || '0', 10) : 0;

          if (scriptIdPart) {
               scripts.push({
                  user_id: user_id,
                  script_id: scriptIdPart,
                  title: title,
                  publication_url: publication_url,
                  image_url: image_url,
                  likes: isNaN(likes) ? 0 : likes,
                  reviews_count: isNaN(reviews_count) ? 0 : reviews_count,
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
