
import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../../_shared/cors.ts';
import { decrypt } from '../utils/crypto.ts';

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
 * Fetches the user's profile page and extracts script information.
 * The profile page lists all published scripts with their names.
 */
async function fetchScriptNamesFromProfile(
  username: string,
  sessionCookie: string,
  signedSessionCookie: string
): Promise<Map<string, { title: string; publicationUrl: string | null }>> {
  // Try the user's published scripts page
  const url = `https://www.tradingview.com/u/${username}/#published-scripts`;
  
  console.log(`Fetching script names from profile page: ${url}`);

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Cookie': `sessionid=${sessionCookie}; sessionid_sign=${signedSessionCookie}`,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
    },
  });

  if (!response.ok) {
    console.error(`Profile page returned status: ${response.status}`);
    return new Map();
  }

  const html = await response.text();
  const scriptMap = new Map<string, { title: string; publicationUrl: string | null }>();
  
  console.log(`Fetched profile page, HTML length: ${html.length}`);

  // Pattern 1: Look for script cards with links like /script/XXXXX/ and titles
  // Scripts are usually in cards with the format: <a href="/script/SLUG/">Title</a>
  const scriptCardPattern = /<a[^>]*href="(\/script\/([^\/]+)\/)"[^>]*>[\s\S]*?<[^>]*class="[^"]*title[^"]*"[^>]*>([^<]+)/gi;
  let match;
  while ((match = scriptCardPattern.exec(html)) !== null) {
    const url = 'https://www.tradingview.com' + match[1];
    const slug = match[2];
    const title = match[3].trim();
    console.log(`Found script via card: ${title} -> ${slug}`);
    // We don't have pine_id here, but we can try to map by slug
  }

  // Pattern 2: Look for JSON data in the page that might contain script info
  // TradingView often embeds data in script tags
  const jsonPatterns = [
    /window\.__NUXT__\s*=\s*({[\s\S]*?});?\s*<\/script>/,
    /window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?});?\s*<\/script>/,
    /"scripts"\s*:\s*(\[[\s\S]*?\])/,
    /"publications"\s*:\s*(\[[\s\S]*?\])/,
  ];

  for (const pattern of jsonPatterns) {
    const jsonMatch = html.match(pattern);
    if (jsonMatch) {
      try {
        const data = JSON.parse(jsonMatch[1]);
        console.log(`Found JSON data with pattern, parsing...`);
        // Try to extract script info from the data
        if (Array.isArray(data)) {
          for (const item of data) {
            if (item.pine_id && item.name) {
              scriptMap.set(item.pine_id, {
                title: item.name,
                publicationUrl: item.url || null,
              });
            }
          }
        }
      } catch (e) {
        console.log(`Could not parse JSON data`);
      }
    }
  }

  // Pattern 3: Extract from TV data attributes that might contain pine_ids
  const dataAttributePattern = /data-script-id="(PUB;[a-f0-9]+)"[^>]*>[\s\S]*?<[^>]*>([^<]+)/gi;
  while ((match = dataAttributePattern.exec(html)) !== null) {
    const pineId = match[1];
    const title = match[2].trim();
    if (pineId && title && !scriptMap.has(pineId)) {
      console.log(`Found script via data attribute: ${title} -> ${pineId}`);
      scriptMap.set(pineId, { title, publicationUrl: null });
    }
  }

  // Pattern 4: Look for script titles in typical TV page structure
  // Often scripts are listed with class names like "tv-widget-idea__title"
  const titlePattern = /<[^>]*class="[^"]*(?:script-name|idea-title|widget-idea__title)[^"]*"[^>]*>([^<]+)<\/[^>]*>[\s\S]*?(PUB;[a-f0-9]+)/gi;
  while ((match = titlePattern.exec(html)) !== null) {
    const title = match[1].trim();
    const pineId = match[2];
    if (pineId && title && !scriptMap.has(pineId)) {
      console.log(`Found script via title class: ${title} -> ${pineId}`);
      scriptMap.set(pineId, { title, publicationUrl: null });
    }
  }

  console.log(`Extracted ${scriptMap.size} script names from profile page`);
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

    // Step 2: Fetch script names from profile page (single request)
    const scriptNamesMap = await fetchScriptNamesFromProfile(profile.tradingview_username, sessionCookie, signedSessionCookie);
    
    // Step 3: Build scripts list using the fetched names
    const scriptsToUpsert = [];
    
    for (const pineId of pineIds) {
      const scriptSlug = pineId.replace('PUB;', '');
      const metadata = scriptNamesMap.get(pineId);
      
      // Build a fallback URL pointing to user's scripts page if we don't have the direct URL
      const fallbackUrl = `https://www.tradingview.com/u/${profile.tradingview_username}/#published-scripts`;
      
      scriptsToUpsert.push({
        user_id: user_id,
        script_id: pineId,
        pine_id: pineId,
        title: metadata?.title || `Script ${scriptSlug}`,
        publication_url: metadata?.publicationUrl || fallbackUrl,
        image_url: null,
        likes: 0,
        reviews_count: 0,
        last_synced_at: new Date().toISOString(),
      });
    }

    console.log(`Prepared ${scriptsToUpsert.length} scripts for upsert (${scriptNamesMap.size} names found)`);

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
