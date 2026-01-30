
import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../../_shared/cors.ts';
import { decrypt } from '../utils/crypto.ts';

interface PineFacadeScript {
  scriptName: string;
  scriptIdPart: string;
  scriptAccess: 'invite_only' | 'open_no_auth' | string;
  // Potentially more fields from the API
  imageUrl?: string;
  scriptSource?: string;
  slug?: string;
}

interface ScriptMetadata {
  title: string;
  publicationUrl: string | null;
  imageUrl: string | null;
  pineId: string;
  accessType: string;
}

/**
 * PRIMARY METHOD: Fetch scripts from Pine Facade API.
 * This endpoint returns complete script objects with titles and access types.
 * Based on the working Python implementation.
 */
async function fetchScriptsFromPineFacade(
  sessionCookie: string,
  signedSessionCookie: string
): Promise<ScriptMetadata[]> {
  const url = 'https://pine-facade.tradingview.com/pine-facade/list';
  const params = new URLSearchParams({
    filter: 'published',
    limit: '100'
  });
  
  console.log('PRIMARY: Fetching scripts from Pine Facade API...');

  try {
    const response = await fetch(`${url}?${params}`, {
      method: 'GET',
      headers: {
        'Origin': 'https://www.tradingview.com',
        'Referer': 'https://www.tradingview.com/',
        'Cookie': `sessionid=${sessionCookie}; sessionid_sign=${signedSessionCookie}`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`Pine Facade API returned status: ${response.status}`);
      const errorText = await response.text();
      console.error('Error response:', errorText);
      return [];
    }

    const data = await response.json();
    
    // The API returns either a direct list or an object with a 'results' key
    const scripts: PineFacadeScript[] = Array.isArray(data) ? data : (data.results || []);
    
    console.log(`Pine Facade API: Found ${scripts.length} scripts`);

    const results: ScriptMetadata[] = [];
    
    for (const script of scripts) {
      // Normalize the pine_id to always have PUB; prefix
      const pineId = script.scriptIdPart?.startsWith('PUB;') 
        ? script.scriptIdPart 
        : `PUB;${script.scriptIdPart}`;
      
      const title = script.scriptName || 'Untitled Script';
      const accessType = script.scriptAccess || 'unknown';
      
      // Check for publication URL in the response
      let publicationUrl: string | null = null;
      if (script.scriptSource) {
        publicationUrl = `https://www.tradingview.com/script/${script.scriptSource}/`;
      } else if (script.slug) {
        publicationUrl = `https://www.tradingview.com/script/${script.slug}/`;
      }
      
      results.push({
        title,
        pineId,
        accessType,
        publicationUrl,
        imageUrl: script.imageUrl || null,
      });

      console.log(`  - "${title}" (${pineId}) [${accessType}]`);
    }

    return results;
  } catch (error) {
    console.error('Error fetching from Pine Facade API:', error);
    return [];
  }
}

/**
 * FALLBACK: Fetches all published Pine IDs owned by the authenticated seller.
 * Uses the list_scripts endpoint which returns an array of Pine IDs.
 */
async function fetchPublishedPineIds(
  sessionCookie: string,
  signedSessionCookie: string
): Promise<string[]> {
  const url = 'https://www.tradingview.com/pine_perm/list_scripts/';
  
  console.log('FALLBACK: Fetching Pine IDs from list_scripts endpoint...');

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
  console.log(`FALLBACK: Found ${pineIds.length} Pine IDs`);
  
  return pineIds;
}

/**
 * FALLBACK Method: Use TradingView's internal search API to find script info by title.
 * Used to find publication URLs when Pine Facade doesn't provide them.
 */
async function findPublicationUrlByTitle(
  scriptTitle: string,
  sessionCookie: string,
  signedSessionCookie: string
): Promise<{ url: string | null; imageUrl: string | null }> {
  try {
    // Use exact title search
    const searchUrl = `https://www.tradingview.com/pubscripts-suggest-json/?search=${encodeURIComponent(scriptTitle)}`;
    
    const response = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'Origin': 'https://www.tradingview.com',
        'Cookie': `sessionid=${sessionCookie}; sessionid_sign=${signedSessionCookie}`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      return { url: null, imageUrl: null };
    }

    const data = await response.json();
    
    if (Array.isArray(data) && data.length > 0) {
      // Find the script with matching title (case-insensitive)
      const exactMatch = data.find(
        (item: any) => item.scriptName?.toLowerCase() === scriptTitle.toLowerCase()
      );
      
      const match = exactMatch || data[0];
      
      if (match) {
        const slug = match.scriptSource || match.slug;
        return {
          url: slug ? `https://www.tradingview.com/script/${slug}/` : null,
          imageUrl: match.imageUrl || match.image || null,
        };
      }
    }
  } catch (error) {
    console.log(`Search API lookup failed for "${scriptTitle}":`, error);
  }

  return { url: null, imageUrl: null };
}

/**
 * FALLBACK Method: Fetch script titles from the Access Manager page.
 */
async function fetchScriptTitlesFromAccessManager(
  sessionCookie: string,
  signedSessionCookie: string
): Promise<Map<string, string>> {
  const titleMap = new Map<string, string>();
  
  try {
    const url = 'https://www.tradingview.com/pine_perm/add/';
    console.log('FALLBACK: Fetching Access Manager page for script titles...');
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Origin': 'https://www.tradingview.com',
        'Cookie': `sessionid=${sessionCookie}; sessionid_sign=${signedSessionCookie}`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    if (!response.ok) {
      console.log(`Access Manager page returned status: ${response.status}`);
      return titleMap;
    }

    const html = await response.text();

    // Pattern: Look for <option value="PUB;...">Title</option>
    const optionRegex = /<option[^>]*value=["'](PUB;[a-f0-9]+)["'][^>]*>([^<]+)<\/option>/gi;
    let match;
    while ((match = optionRegex.exec(html)) !== null) {
      const pineId = match[1];
      const title = match[2].trim();
      if (title && !title.toLowerCase().includes('select') && !title.toLowerCase().includes('choose')) {
        titleMap.set(pineId, title);
      }
    }

    console.log(`Access Manager: Extracted ${titleMap.size} script titles`);
  } catch (error) {
    console.error('Error fetching Access Manager page:', error);
  }

  return titleMap;
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
    const fallbackUrl = `https://www.tradingview.com/u/${profile.tradingview_username}/#published-scripts`;
    let scriptsToUpsert: any[] = [];

    // ============================================
    // PRIMARY METHOD: Pine Facade API
    // ============================================
    const pineFacadeScripts = await fetchScriptsFromPineFacade(sessionCookie, signedSessionCookie);

    if (pineFacadeScripts.length > 0) {
      console.log(`\n✅ Pine Facade API succeeded with ${pineFacadeScripts.length} scripts`);
      
      // For scripts without publication URLs, try to find them via search API
      for (const script of pineFacadeScripts) {
        let publicationUrl = script.publicationUrl;
        let imageUrl = script.imageUrl;

        // If no URL from Pine Facade, try search API
        if (!publicationUrl && script.title && script.title !== 'Untitled Script') {
          console.log(`  Looking up URL for: "${script.title}"`);
          const searchResult = await findPublicationUrlByTitle(
            script.title,
            sessionCookie,
            signedSessionCookie
          );
          if (searchResult.url) {
            publicationUrl = searchResult.url;
            console.log(`    Found URL: ${publicationUrl}`);
          }
          if (searchResult.imageUrl && !imageUrl) {
            imageUrl = searchResult.imageUrl;
          }
        }

        scriptsToUpsert.push({
          user_id: user_id,
          script_id: script.pineId,
          pine_id: script.pineId,
          title: script.title,
          publication_url: publicationUrl || fallbackUrl,
          image_url: imageUrl,
          likes: 0,
          reviews_count: 0,
          last_synced_at: new Date().toISOString(),
        });
      }
    } else {
      // ============================================
      // FALLBACK: Old method with Pine IDs + Access Manager
      // ============================================
      console.log('\n⚠️ Pine Facade API failed, using fallback methods...');
      
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

      // Get titles from Access Manager
      const accessManagerTitles = await fetchScriptTitlesFromAccessManager(sessionCookie, signedSessionCookie);
      
      for (const pineId of pineIds) {
        const scriptSlug = pineId.replace('PUB;', '').slice(0, 8);
        let title = accessManagerTitles.get(pineId) || `Script ${scriptSlug}`;
        let publicationUrl: string | null = null;
        let imageUrl: string | null = null;

        // Try to find URL via search if we have a real title
        if (!title.startsWith('Script ')) {
          const searchResult = await findPublicationUrlByTitle(title, sessionCookie, signedSessionCookie);
          publicationUrl = searchResult.url;
          imageUrl = searchResult.imageUrl;
        }

        scriptsToUpsert.push({
          user_id: user_id,
          script_id: pineId,
          pine_id: pineId,
          title: title,
          publication_url: publicationUrl || fallbackUrl,
          image_url: imageUrl,
          likes: 0,
          reviews_count: 0,
          last_synced_at: new Date().toISOString(),
        });
      }
    }

    // ============================================
    // Upsert to database
    // ============================================
    console.log(`\nPrepared ${scriptsToUpsert.length} scripts for upsert`);
    console.log(`- With real titles: ${scriptsToUpsert.filter(s => !s.title.startsWith('Script ')).length}`);
    console.log(`- With real URLs: ${scriptsToUpsert.filter(s => !s.publication_url.includes('#published-scripts')).length}`);

    if (scriptsToUpsert.length > 0) {
      const { error: upsertError } = await supabaseAdmin
        .from('tradingview_scripts')
        .upsert(scriptsToUpsert, { onConflict: 'user_id,script_id' });

      if (upsertError) {
        console.error('Error upserting scripts:', upsertError);
        throw upsertError;
      }
    }

    // Update connection status
    await supabaseAdmin
      .from('profiles')
      .update({ 
        tradingview_connection_status: 'active',
        tradingview_last_validated_at: new Date().toISOString(),
        tradingview_last_error: null
      })
      .eq('id', user_id);

    const scriptsWithTitles = scriptsToUpsert.filter(s => !s.title.startsWith('Script ')).length;
    const scriptsWithUrls = scriptsToUpsert.filter(s => !s.publication_url.includes('#published-scripts')).length;

    return new Response(JSON.stringify({ 
      message: `Sync complete. Found ${scriptsToUpsert.length} scripts. ${scriptsWithTitles} with titles, ${scriptsWithUrls} with direct URLs.`,
      scripts_count: scriptsToUpsert.length,
      scripts_with_titles: scriptsWithTitles,
      scripts_with_urls: scriptsWithUrls,
      method: pineFacadeScripts.length > 0 ? 'pine-facade' : 'fallback',
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
