
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
 * Fetches the Access Manager page and extracts script names mapped to pine_ids.
 * The Access Manager page shows all scripts with their names and pine_ids.
 */
async function fetchScriptNamesFromAccessManager(
  sessionCookie: string,
  signedSessionCookie: string
): Promise<Map<string, { title: string; publicationUrl: string | null }>> {
  const url = 'https://www.tradingview.com/pine-script-access-manager/';
  
  console.log('Fetching script names from Access Manager page...');

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Cookie': `sessionid=${sessionCookie}; sessionid_sign=${signedSessionCookie}`,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  });

  if (!response.ok) {
    console.error(`Access Manager page returned status: ${response.status}`);
    return new Map();
  }

  const html = await response.text();
  const scriptMap = new Map<string, { title: string; publicationUrl: string | null }>();

  // Look for script data in the page - the Access Manager typically has 
  // a data structure or list items with pine_ids and script names
  
  // Pattern 1: Look for JSON data embedded in the page (common in React/Vue apps)
  const jsonDataMatch = html.match(/window\.__INITIAL_DATA__\s*=\s*({[\s\S]*?});/);
  if (jsonDataMatch) {
    try {
      const data = JSON.parse(jsonDataMatch[1]);
      console.log('Found __INITIAL_DATA__, parsing scripts...');
      // Navigate the data structure to find scripts
      if (data.scripts) {
        for (const script of data.scripts) {
          if (script.pine_id && script.name) {
            scriptMap.set(script.pine_id, {
              title: script.name,
              publicationUrl: script.url || null,
            });
          }
        }
      }
    } catch (e) {
      console.log('Could not parse __INITIAL_DATA__ JSON');
    }
  }

  // Pattern 2: Look for script entries in HTML structure
  // The access manager typically lists scripts with data attributes or in list items
  const scriptEntryPattern = /<div[^>]*data-pine-id="(PUB;[a-f0-9]+)"[^>]*>[\s\S]*?<[^>]*class="[^"]*title[^"]*"[^>]*>([^<]+)</gi;
  let match;
  while ((match = scriptEntryPattern.exec(html)) !== null) {
    const pineId = match[1];
    const title = match[2].trim();
    if (pineId && title && !scriptMap.has(pineId)) {
      scriptMap.set(pineId, { title, publicationUrl: null });
    }
  }

  // Pattern 3: Look for option elements in select dropdowns (common pattern)
  const selectPattern = /<option[^>]*value="(PUB;[a-f0-9]+)"[^>]*>([^<]+)</gi;
  while ((match = selectPattern.exec(html)) !== null) {
    const pineId = match[1];
    const title = match[2].trim();
    if (pineId && title && !scriptMap.has(pineId)) {
      scriptMap.set(pineId, { title, publicationUrl: null });
    }
  }

  // Pattern 4: Look for anchor links to scripts with pine_id references
  const linkPattern = /<a[^>]*href="(\/script\/[^"\/]+\/)"[^>]*>([^<]+)<\/a>[\s\S]*?(PUB;[a-f0-9]+)/gi;
  while ((match = linkPattern.exec(html)) !== null) {
    const url = 'https://www.tradingview.com' + match[1];
    const title = match[2].trim();
    const pineId = match[3];
    if (pineId && title && !scriptMap.has(pineId)) {
      scriptMap.set(pineId, { title, publicationUrl: url });
    }
  }

  console.log(`Extracted ${scriptMap.size} script names from Access Manager`);
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

    // Step 2: Fetch script names from Access Manager page (single request)
    const scriptNamesMap = await fetchScriptNamesFromAccessManager(sessionCookie, signedSessionCookie);
    
    // Step 3: Build scripts list using the fetched names
    const scriptsToUpsert = [];
    
    for (const pineId of pineIds) {
      const scriptSlug = pineId.replace('PUB;', '');
      const metadata = scriptNamesMap.get(pineId);
      
      scriptsToUpsert.push({
        user_id: user_id,
        script_id: pineId,
        pine_id: pineId,
        title: metadata?.title || `Script ${scriptSlug}`,
        publication_url: metadata?.publicationUrl || null,
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
