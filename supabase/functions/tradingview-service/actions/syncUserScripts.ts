
import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../../_shared/cors.ts';
import { decrypt } from '../utils/crypto.ts';

interface ScriptMetadata {
  title: string;
  publicationUrl: string;
  imageUrl: string | null;
}

/**
 * Fetches all published Pine IDs owned by the authenticated seller.
 * Uses the list_scripts endpoint which returns an array of Pine IDs.
 */
async function fetchPublishedPineIds(
  sessionCookie: string,
  signedSessionCookie: string
): Promise<string[]> {
  const url = 'https://www.tradingview.com/pine_perm/list_scripts/';
  
  console.log('Fetching published Pine IDs from list_scripts endpoint...');

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Origin': 'https://www.tradingview.com',
      'Cookie': `sessionid=${sessionCookie}; sessionid_sign=${signedSessionCookie}`,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  });

  if (!response.ok) {
    console.error(`list_scripts API returned status: ${response.status}`);
    const errorText = await response.text();
    console.error('Error response:', errorText);
    throw new Error(`Failed to fetch Pine IDs: ${response.status}`);
  }

  const pineIds: string[] = await response.json();
  console.log(`Found ${pineIds.length} published Pine IDs`);
  
  return pineIds;
}

/**
 * Fetches script metadata from the user's published scripts JSON API.
 * TradingView provides a JSON endpoint that lists all user scripts.
 */
async function fetchScriptsFromUserAPI(
  username: string,
  sessionCookie: string,
  signedSessionCookie: string
): Promise<Map<string, ScriptMetadata>> {
  const scriptMap = new Map<string, ScriptMetadata>();
  
  // TradingView has multiple URL variants for the scripts listing; some return 404 depending on account/state.
  // We try a small set and use the first that returns 200.
  const apiUrlCandidates = [
    `https://www.tradingview.com/u/${username}/scripts/`,
    `https://www.tradingview.com/u/${username}/scripts/?sort=popularity`,
    `https://www.tradingview.com/u/${username}/scripts/?sort=recent`,
  ];
  
  console.log(`Fetching scripts for username '${username}' from candidate URLs...`);

  try {
    let html: string | null = null;
    let usedUrl: string | null = null;

    for (const apiUrl of apiUrlCandidates) {
      console.log(`Fetching scripts from: ${apiUrl}`);
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Cookie': `sessionid=${sessionCookie}; sessionid_sign=${signedSessionCookie}`,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
      });

      if (response.ok) {
        html = await response.text();
        usedUrl = apiUrl;
        break;
      }

      console.error(`Scripts page returned status ${response.status} for ${apiUrl}`);
    }

    if (!html) {
      console.error('All scripts page URL candidates failed; cannot extract publication URLs');
      return scriptMap;
    }

    console.log(`Fetched scripts page OK from: ${usedUrl}`);
    console.log(`Fetched scripts page, HTML length: ${html.length}`);

    // Pattern 1: Extract script data from the page
    // TradingView pages often have script cards with format: /script/SLUG/
    const scriptCardRegex = /<a[^>]*href="(\/script\/([^"\/]+)\/)"[^>]*>/gi;
    const titleRegex = /<div[^>]*class="[^"]*(?:tv-widget-idea__title|title)[^"]*"[^>]*>([^<]+)<\/div>/gi;
    
    // Find all script URLs
    const scriptUrls: string[] = [];
    let match;
    while ((match = scriptCardRegex.exec(html)) !== null) {
      const url = 'https://www.tradingview.com' + match[1];
      if (!scriptUrls.includes(url)) {
        scriptUrls.push(url);
        console.log(`Found script URL: ${url}`);
      }
    }

    // Also try to find JSON data embedded in the page
    const jsonDataPatterns = [
      /"scripts"\s*:\s*(\[[\s\S]*?\])/,
      /"publications"\s*:\s*(\[[\s\S]*?\])/,
      /window\.__SCRIPTS__\s*=\s*(\[[\s\S]*?\]);/,
    ];

    for (const pattern of jsonDataPatterns) {
      const jsonMatch = html.match(pattern);
      if (jsonMatch) {
        try {
          const data = JSON.parse(jsonMatch[1]);
          console.log(`Found JSON data with ${Array.isArray(data) ? data.length : 0} items`);
          if (Array.isArray(data)) {
            for (const item of data) {
              if (item.scriptIdPart && item.scriptName) {
                const pineId = item.scriptIdPart.startsWith('PUB;') ? item.scriptIdPart : `PUB;${item.scriptIdPart}`;
                scriptMap.set(pineId, {
                  title: item.scriptName,
                  publicationUrl: item.publishedUrl || `https://www.tradingview.com/script/${item.slug}/`,
                  imageUrl: item.imageUrl || null,
                });
              }
            }
          }
        } catch (e) {
          console.log('Could not parse embedded JSON data');
        }
      }
    }

    // If we found script URLs, fetch each one to get the pine_id mapping
    if (scriptUrls.length > 0 && scriptMap.size === 0) {
      console.log(`Fetching ${Math.min(scriptUrls.length, 10)} script pages for metadata...`);
      
      // Limit to first 10 scripts to avoid rate limiting
      const urlsToFetch = scriptUrls.slice(0, 10);
      
      for (const scriptUrl of urlsToFetch) {
        try {
          const scriptResponse = await fetch(scriptUrl, {
            method: 'GET',
            headers: {
              'Cookie': `sessionid=${sessionCookie}; sessionid_sign=${signedSessionCookie}`,
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            },
          });

          if (scriptResponse.ok) {
            const scriptHtml = await scriptResponse.text();
            
            // Extract pine_id from the page
            const pineIdMatch = scriptHtml.match(/["']pine_id["']\s*:\s*["'](PUB;[a-f0-9]+)["']/i) ||
                                scriptHtml.match(/data-script-id=["'](PUB;[a-f0-9]+)["']/i) ||
                                scriptHtml.match(/(PUB;[a-f0-9]{32})/i);
            
            // Extract title from <title> tag
            const titleMatch = scriptHtml.match(/<title>([^—<]+)/i);
            
            // Extract image URL
            const imageMatch = scriptHtml.match(/og:image["'][^>]*content=["']([^"']+)["']/i) ||
                              scriptHtml.match(/content=["']([^"']+)["'][^>]*og:image/i);

            if (pineIdMatch && titleMatch) {
              const pineId = pineIdMatch[1];
              const title = titleMatch[1].trim();
              
              console.log(`Mapped: ${pineId} -> ${title}`);
              
              scriptMap.set(pineId, {
                title: title,
                publicationUrl: scriptUrl,
                imageUrl: imageMatch ? imageMatch[1] : null,
              });
            }
          }
        } catch (e) {
          console.error(`Failed to fetch ${scriptUrl}:`, e);
        }
      }
    }

  } catch (error) {
    console.error('Error fetching scripts from user API:', error);
  }

  console.log(`Extracted ${scriptMap.size} scripts with metadata`);
  return scriptMap;
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
    // Step 1: Fetch all Pine IDs using the list_scripts endpoint
    const pineIds = await fetchPublishedPineIds(sessionCookie, signedSessionCookie);

    if (pineIds.length === 0) {
      await supabaseAdmin
        .from('profiles')
        .update({ 
          tradingview_connection_status: 'active',
          tradingview_last_validated_at: new Date().toISOString(),
          tradingview_last_error: null
        })
        .eq('id', user_id);

      return new Response(JSON.stringify({ 
        message: `Sync complete. You have no published scripts on TradingView.`,
        scripts_count: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // Step 2: Fetch script metadata from user's scripts page
    const scriptMetadataMap = await fetchScriptsFromUserAPI(profile.tradingview_username, sessionCookie, signedSessionCookie);
    
    // Step 3: Build scripts list using the fetched metadata
    const scriptsToUpsert = [];
    
    for (const pineId of pineIds) {
      const scriptSlug = pineId.replace('PUB;', '');
      const metadata = scriptMetadataMap.get(pineId);
      
      // Build a fallback URL pointing to user's scripts page if we don't have the direct URL
      const fallbackUrl = `https://www.tradingview.com/u/${profile.tradingview_username}/#published-scripts`;
      
      scriptsToUpsert.push({
        user_id: user_id,
        script_id: pineId,
        pine_id: pineId,
        title: metadata?.title || `Script ${scriptSlug}`,
        publication_url: metadata?.publicationUrl || fallbackUrl,
        image_url: metadata?.imageUrl || null,
        likes: 0,
        reviews_count: 0,
        last_synced_at: new Date().toISOString(),
      });
    }

    console.log(`Prepared ${scriptsToUpsert.length} scripts for upsert (${scriptMetadataMap.size} metadata found)`);

    // Step 4: Upsert scripts to database
    if (scriptsToUpsert.length > 0) {
      const { error: upsertError } = await supabaseAdmin
        .from('tradingview_scripts')
        .upsert(scriptsToUpsert, { onConflict: 'user_id,script_id' });

      if (upsertError) {
        console.error('Error upserting scripts:', upsertError);
        throw upsertError;
      }
    }

    // Step 5: Update connection status
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
