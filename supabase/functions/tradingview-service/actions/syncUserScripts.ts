
import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { DOMParser } from 'https://deno.land/x/deno_dom/deno-dom-wasm.ts';
import { corsHeaders } from '../../_shared/cors.ts';
import { decrypt } from '../utils/crypto.ts';

interface ScriptInfo {
  pineId: string;
  title: string;
  publicationUrl: string;
  imageUrl: string | null;
}

/**
 * Fetches all published scripts from a user's TradingView profile page.
 * Scrapes the profile page to find script links and metadata.
 */
async function fetchPublishedScripts(
  username: string,
  sessionCookie: string,
  signedSessionCookie: string
): Promise<ScriptInfo[]> {
  const scripts: ScriptInfo[] = [];
  
  console.log(`Fetching published scripts for user: ${username}`);
  
  // Fetch the user's scripts page
  const profileUrl = `https://www.tradingview.com/u/${username}/#published-scripts`;
  
  const response = await fetch(profileUrl, {
    method: 'GET',
    headers: {
      'Cookie': `sessionid=${sessionCookie}; sessionid_sign=${signedSessionCookie}`,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  });

  if (!response.ok) {
    console.error(`Failed to fetch profile page: ${response.status}`);
    throw new Error(`Failed to fetch profile page: ${response.status}`);
  }

  const html = await response.text();
  const doc = new DOMParser().parseFromString(html, 'text/html');
  
  if (!doc) {
    console.error('Failed to parse profile page HTML');
    throw new Error('Failed to parse profile page');
  }

  // Find script cards on the profile page
  // TradingView uses data attributes for script IDs
  const scriptElements = doc.querySelectorAll('[data-widget-type="idea"]');
  
  console.log(`Found ${scriptElements.length} script elements on profile page`);
  
  for (const element of scriptElements) {
    try {
      const dataId = element.getAttribute('data-id');
      const linkElement = element.querySelector('a[href*="/script/"]');
      const titleElement = element.querySelector('.tv-widget-idea__title');
      const imgElement = element.querySelector('img');
      
      if (linkElement) {
        const href = linkElement.getAttribute('href') || '';
        const scriptMatch = href.match(/\/script\/([^/]+)/);
        
        if (scriptMatch) {
          const scriptSlug = scriptMatch[1];
          const pineId = dataId || `PUB;${scriptSlug}`;
          const title = titleElement?.textContent?.trim() || `Script ${scriptSlug}`;
          const imageUrl = imgElement?.getAttribute('src') || null;
          
          scripts.push({
            pineId,
            title,
            publicationUrl: `https://www.tradingview.com/script/${scriptSlug}/`,
            imageUrl,
          });
        }
      }
    } catch (err) {
      console.error('Error parsing script element:', err);
    }
  }

  // Alternative: Look for script links in any format
  if (scripts.length === 0) {
    console.log('No scripts found via widget elements, trying alternative parsing...');
    
    const allLinks = doc.querySelectorAll('a[href*="/script/"]');
    const seenSlugs = new Set<string>();
    
    for (const link of allLinks) {
      const href = link.getAttribute('href') || '';
      const match = href.match(/\/script\/([a-zA-Z0-9]+)/);
      
      if (match && !seenSlugs.has(match[1])) {
        seenSlugs.add(match[1]);
        const scriptSlug = match[1];
        
        scripts.push({
          pineId: `PUB;${scriptSlug}`,
          title: link.textContent?.trim() || `Script ${scriptSlug}`,
          publicationUrl: `https://www.tradingview.com/script/${scriptSlug}/`,
          imageUrl: null,
        });
      }
    }
  }

  console.log(`Parsed ${scripts.length} scripts from profile page`);
  return scripts;
}

/**
 * Fetches the Pine ID for a script from its publication page.
 * The Pine ID is needed for access control operations.
 */
async function fetchPineIdFromScriptPage(
  publicationUrl: string,
  sessionCookie: string,
  signedSessionCookie: string
): Promise<string | null> {
  try {
    const response = await fetch(publicationUrl, {
      method: 'GET',
      headers: {
        'Cookie': `sessionid=${sessionCookie}; sessionid_sign=${signedSessionCookie}`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (!response.ok) {
      return null;
    }

    const html = await response.text();
    
    // Look for Pine ID in the page - it's typically in a data attribute or script tag
    // Pattern: "pine_id":"PUB;xxxxx" or data-pine-id="PUB;xxxxx"
    const pineIdMatch = html.match(/"pine_id"\s*:\s*"([^"]+)"/);
    if (pineIdMatch) {
      return pineIdMatch[1];
    }
    
    // Alternative pattern
    const dataPineIdMatch = html.match(/data-pine-id="([^"]+)"/);
    if (dataPineIdMatch) {
      return dataPineIdMatch[1];
    }

    // Try to find it in the script's add to chart button or other elements
    const addToChartMatch = html.match(/PUB;[a-zA-Z0-9]+/);
    if (addToChartMatch) {
      return addToChartMatch[0];
    }

    return null;
  } catch (error) {
    console.error(`Error fetching pine ID from ${publicationUrl}:`, error);
    return null;
  }
}

export async function syncUserScripts(
  payload: any,
  supabaseAdmin: SupabaseClient,
  key: CryptoKey
): Promise<Response> {
  const { user_id } = payload;
  
  if (!user_id) {
    return new Response(JSON.stringify({ error: 'Missing user ID.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Fetch user profile with TradingView credentials
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('is_tradingview_connected, tradingview_session_cookie, tradingview_signed_session_cookie, tradingview_username')
    .eq('id', user_id)
    .single();

  if (profileError || !profile) {
    return new Response(JSON.stringify({ error: 'User profile not found.' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!profile.is_tradingview_connected || 
      !profile.tradingview_session_cookie || 
      !profile.tradingview_signed_session_cookie || 
      !profile.tradingview_username) {
    return new Response(JSON.stringify({ 
      error: 'TradingView not connected. Please connect your account in settings.' 
    }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Decrypt session cookies
  const sessionCookie = await decrypt(profile.tradingview_session_cookie, key);
  const signedSessionCookie = await decrypt(profile.tradingview_signed_session_cookie, key);

  console.log(`Syncing scripts for user: ${user_id}, TV username: ${profile.tradingview_username}`);

  try {
    // Step 1: Fetch published scripts from profile page
    const publishedScripts = await fetchPublishedScripts(
      profile.tradingview_username,
      sessionCookie,
      signedSessionCookie
    );

    if (publishedScripts.length === 0) {
      // Update connection status and return
      await supabaseAdmin
        .from('profiles')
        .update({ 
          tradingview_connection_status: 'active',
          tradingview_last_validated_at: new Date().toISOString(),
          tradingview_last_error: null
        })
        .eq('id', user_id);

      return new Response(JSON.stringify({ 
        message: `Sync complete. Found 0 published scripts for '${profile.tradingview_username}'.`,
        scripts_count: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // Step 2: For each script, try to get the Pine ID if we don't have it
    const scriptsToUpsert = [];
    
    for (const script of publishedScripts) {
      let pineId = script.pineId;
      
      // If the pineId doesn't look like a proper Pine ID, fetch it from the script page
      if (!pineId.startsWith('PUB;') || pineId === 'PUB;') {
        console.log(`Fetching Pine ID for ${script.publicationUrl}`);
        const fetchedPineId = await fetchPineIdFromScriptPage(
          script.publicationUrl,
          sessionCookie,
          signedSessionCookie
        );
        
        if (fetchedPineId) {
          pineId = fetchedPineId;
        } else {
          // Extract from URL as fallback
          const match = script.publicationUrl.match(/\/script\/([a-zA-Z0-9]+)/);
          if (match) {
            pineId = `PUB;${match[1]}`;
          }
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      
      scriptsToUpsert.push({
        user_id: user_id,
        script_id: pineId,
        pine_id: pineId,
        title: script.title,
        publication_url: script.publicationUrl,
        image_url: script.imageUrl,
        likes: 0,
        reviews_count: 0,
        last_synced_at: new Date().toISOString(),
      });
    }

    console.log(`Prepared ${scriptsToUpsert.length} scripts for upsert`);

    // Step 3: Upsert scripts to database
    if (scriptsToUpsert.length > 0) {
      const { error: upsertError } = await supabaseAdmin
        .from('tradingview_scripts')
        .upsert(scriptsToUpsert, { onConflict: 'user_id,script_id' });

      if (upsertError) {
        console.error('Error upserting scripts:', upsertError);
        throw upsertError;
      }
    }

    // Step 4: Update connection status
    await supabaseAdmin
      .from('profiles')
      .update({ 
        tradingview_connection_status: 'active',
        tradingview_last_validated_at: new Date().toISOString(),
        tradingview_last_error: null
      })
      .eq('id', user_id);

    return new Response(JSON.stringify({ 
      message: `Sync complete. Found and synced ${scriptsToUpsert.length} scripts for '${profile.tradingview_username}'.`,
      scripts_count: scriptsToUpsert.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Error syncing scripts:', error);
    
    // Update connection status with error
    await supabaseAdmin
      .from('profiles')
      .update({ 
        tradingview_connection_status: 'error',
        tradingview_last_error: error instanceof Error ? error.message : 'Unknown error during sync'
      })
      .eq('id', user_id);

    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Failed to sync scripts'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}
