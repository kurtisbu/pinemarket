
import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../../_shared/cors.ts';
import { decrypt } from '../utils/crypto.ts';

interface ScriptMetadata {
  title: string;
  publicationUrl: string | null;
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
 * Method A: Fetch script titles from the Access Manager page (/pine_perm/add/).
 * This page contains a dropdown with script titles and their Pine IDs.
 */
async function fetchScriptTitlesFromAccessManager(
  sessionCookie: string,
  signedSessionCookie: string
): Promise<Map<string, string>> {
  const titleMap = new Map<string, string>();
  
  try {
    const url = 'https://www.tradingview.com/pine_perm/add/';
    console.log('Fetching Access Manager page for script titles...');
    
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
    console.log(`Access Manager page HTML length: ${html.length}`);

    // Pattern 1: Look for <option value="PUB;...">Title</option>
    const optionRegex = /<option[^>]*value=["'](PUB;[a-f0-9]+)["'][^>]*>([^<]+)<\/option>/gi;
    let match;
    while ((match = optionRegex.exec(html)) !== null) {
      const pineId = match[1];
      const title = match[2].trim();
      if (title && !title.toLowerCase().includes('select') && !title.toLowerCase().includes('choose')) {
        titleMap.set(pineId, title);
        console.log(`Access Manager: Found ${pineId} -> ${title}`);
      }
    }

    // Pattern 2: Look for JSON data that might contain script info
    const jsonPatterns = [
      /"scripts"\s*:\s*(\[[\s\S]*?\])/,
      /"pine_ids"\s*:\s*(\{[\s\S]*?\})/,
      /window\.__SCRIPTS__\s*=\s*(\[[\s\S]*?\]);/,
      /data-scripts='(\[[\s\S]*?\])'/,
    ];

    for (const pattern of jsonPatterns) {
      const jsonMatch = html.match(pattern);
      if (jsonMatch) {
        try {
          const data = JSON.parse(jsonMatch[1]);
          console.log(`Found JSON data in Access Manager`);
          if (Array.isArray(data)) {
            for (const item of data) {
              if (item.pine_id && item.title) {
                titleMap.set(item.pine_id, item.title);
              } else if (item.scriptIdPart && item.scriptName) {
                const pineId = item.scriptIdPart.startsWith('PUB;') ? item.scriptIdPart : `PUB;${item.scriptIdPart}`;
                titleMap.set(pineId, item.scriptName);
              }
            }
          }
        } catch (e) {
          console.log('Could not parse JSON from Access Manager');
        }
      }
    }

    // Pattern 3: Look for data attributes with script info
    const dataAttrRegex = /data-pine-id=["'](PUB;[a-f0-9]+)["'][^>]*data-title=["']([^"']+)["']/gi;
    while ((match = dataAttrRegex.exec(html)) !== null) {
      titleMap.set(match[1], match[2].trim());
    }

    // Pattern 4: Reverse order - title first, then pine_id
    const reversedAttrRegex = /data-title=["']([^"']+)["'][^>]*data-pine-id=["'](PUB;[a-f0-9]+)["']/gi;
    while ((match = reversedAttrRegex.exec(html)) !== null) {
      titleMap.set(match[2], match[1].trim());
    }

    console.log(`Access Manager: Extracted ${titleMap.size} script titles`);
  } catch (error) {
    console.error('Error fetching Access Manager page:', error);
  }

  return titleMap;
}

/**
 * Method B: Use TradingView's internal search API to find scripts by username.
 */
async function fetchScriptsFromSearchAPI(
  username: string,
  sessionCookie: string,
  signedSessionCookie: string
): Promise<Map<string, ScriptMetadata>> {
  const scriptMap = new Map<string, ScriptMetadata>();

  try {
    // Try the pubscripts-suggest API with the username
    const searchUrl = `https://www.tradingview.com/pubscripts-suggest-json/?search=${encodeURIComponent(username)}`;
    console.log(`Searching scripts by username: ${searchUrl}`);

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
      console.log(`Search API returned status: ${response.status}`);
      return scriptMap;
    }

    const data = await response.json();
    console.log(`Search API returned ${Array.isArray(data) ? data.length : 0} results`);

    if (Array.isArray(data)) {
      for (const item of data) {
        // The API returns objects with scriptIdPart (pine_id without PUB;), scriptName, etc.
        if (item.scriptIdPart) {
          const pineId = item.scriptIdPart.startsWith('PUB;') ? item.scriptIdPart : `PUB;${item.scriptIdPart}`;
          const slug = item.scriptSource || item.slug;
          
          scriptMap.set(pineId, {
            title: item.scriptName || item.title || `Script ${item.scriptIdPart.slice(0, 8)}`,
            publicationUrl: slug ? `https://www.tradingview.com/script/${slug}/` : null,
            imageUrl: item.imageUrl || item.image || null,
          });
          console.log(`Search API: Found ${pineId} -> ${item.scriptName}`);
        }
      }
    }
  } catch (error) {
    console.error('Error using search API:', error);
  }

  return scriptMap;
}

/**
 * Method C: Fetch the list_scripts API which also returns script details.
 * Some versions of this endpoint return more than just Pine IDs.
 */
async function fetchScriptDetailsFromListScripts(
  sessionCookie: string,
  signedSessionCookie: string
): Promise<Map<string, ScriptMetadata>> {
  const scriptMap = new Map<string, ScriptMetadata>();

  try {
    // Try an alternative endpoint that might return more details
    const url = 'https://www.tradingview.com/pine_perm/list_scripts/?with_details=1';
    console.log('Trying list_scripts with details...');

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Origin': 'https://www.tradingview.com',
        'Cookie': `sessionid=${sessionCookie}; sessionid_sign=${signedSessionCookie}`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.log(`list_scripts with details returned status: ${response.status}`);
      return scriptMap;
    }

    const data = await response.json();
    
    // If the response is an array of objects (not just strings), extract details
    if (Array.isArray(data)) {
      for (const item of data) {
        if (typeof item === 'object' && item.pine_id) {
          scriptMap.set(item.pine_id, {
            title: item.title || item.name || `Script ${item.pine_id.slice(4, 12)}`,
            publicationUrl: item.url || item.publication_url || null,
            imageUrl: item.image || item.image_url || null,
          });
        }
      }
    }

    console.log(`list_scripts details: Extracted ${scriptMap.size} scripts`);
  } catch (error) {
    console.log('list_scripts with details not available or returned different format');
  }

  return scriptMap;
}

/**
 * Method D: Try to get script info from the user's profile page JSON data.
 */
async function fetchScriptsFromProfilePage(
  username: string,
  sessionCookie: string,
  signedSessionCookie: string
): Promise<Map<string, ScriptMetadata>> {
  const scriptMap = new Map<string, ScriptMetadata>();

  try {
    // Try the profile's published scripts JSON API
    const apiUrl = `https://www.tradingview.com/u/${username}/?sort=alpha&type=script`;
    console.log(`Fetching profile page: ${apiUrl}`);

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Cookie': `sessionid=${sessionCookie}; sessionid_sign=${signedSessionCookie}`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'X-Requested-With': 'XMLHttpRequest',
      },
    });

    if (!response.ok) {
      console.log(`Profile page returned status: ${response.status}`);
      return scriptMap;
    }

    const html = await response.text();
    console.log(`Profile page HTML length: ${html.length}`);

    // Look for script cards in the HTML
    // Pattern: /script/SLUG-Title/
    const scriptLinkRegex = /href="(\/script\/([^"\/]+)\/)"[^>]*>([^<]*)</gi;
    let match;
    const foundUrls: { url: string; slug: string; title: string }[] = [];

    while ((match = scriptLinkRegex.exec(html)) !== null) {
      const url = 'https://www.tradingview.com' + match[1];
      const slug = match[2];
      const linkText = match[3].trim();
      
      if (linkText && !foundUrls.some(u => u.slug === slug)) {
        foundUrls.push({ url, slug, title: linkText });
      }
    }

    // Also look for title in data attributes or nearby elements
    const scriptCardRegex = /<div[^>]*class="[^"]*tv-widget-idea[^"]*"[^>]*data-id="([^"]+)"[^>]*>[\s\S]*?<a[^>]*class="[^"]*title[^"]*"[^>]*>([^<]+)<\/a>[\s\S]*?href="(\/script\/[^"]+)"/gi;
    while ((match = scriptCardRegex.exec(html)) !== null) {
      const id = match[1];
      const title = match[2].trim();
      const url = 'https://www.tradingview.com' + match[3];
      
      // The data-id might be the pine_id or a different ID
      if (id.includes(';') || id.length === 32) {
        const pineId = id.startsWith('PUB;') ? id : `PUB;${id}`;
        scriptMap.set(pineId, { title, publicationUrl: url, imageUrl: null });
      }
    }

    console.log(`Profile page: Found ${foundUrls.length} script URLs, ${scriptMap.size} with pine_id mapping`);
  } catch (error) {
    console.error('Error fetching profile page:', error);
  }

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

    console.log(`Found ${pineIds.length} Pine IDs, now fetching metadata...`);

    // Step 2: Try multiple methods to get script titles and URLs
    
    // Method A: Access Manager page
    const accessManagerTitles = await fetchScriptTitlesFromAccessManager(sessionCookie, signedSessionCookie);
    console.log(`Method A (Access Manager): ${accessManagerTitles.size} titles`);
    
    // Method B: Search API
    const searchResults = await fetchScriptsFromSearchAPI(profile.tradingview_username, sessionCookie, signedSessionCookie);
    console.log(`Method B (Search API): ${searchResults.size} scripts`);
    
    // Method C: list_scripts with details (if available)
    const listScriptsDetails = await fetchScriptDetailsFromListScripts(sessionCookie, signedSessionCookie);
    console.log(`Method C (list_scripts details): ${listScriptsDetails.size} scripts`);
    
    // Method D: Profile page scraping
    const profilePageScripts = await fetchScriptsFromProfilePage(profile.tradingview_username, sessionCookie, signedSessionCookie);
    console.log(`Method D (Profile page): ${profilePageScripts.size} scripts`);

    // Step 3: Merge results, prioritizing by method reliability
    const scriptsToUpsert = [];
    const fallbackUrl = `https://www.tradingview.com/u/${profile.tradingview_username}/#published-scripts`;
    
    for (const pineId of pineIds) {
      const scriptSlug = pineId.replace('PUB;', '').slice(0, 8);
      
      // Get title from best available source
      let title = accessManagerTitles.get(pineId);
      let publicationUrl: string | null = null;
      let imageUrl: string | null = null;

      // Try search results
      const searchResult = searchResults.get(pineId);
      if (searchResult) {
        if (!title) title = searchResult.title;
        if (!publicationUrl) publicationUrl = searchResult.publicationUrl;
        if (!imageUrl) imageUrl = searchResult.imageUrl;
      }

      // Try list_scripts details
      const listDetails = listScriptsDetails.get(pineId);
      if (listDetails) {
        if (!title) title = listDetails.title;
        if (!publicationUrl) publicationUrl = listDetails.publicationUrl;
        if (!imageUrl) imageUrl = listDetails.imageUrl;
      }

      // Try profile page results
      const profileResult = profilePageScripts.get(pineId);
      if (profileResult) {
        if (!title) title = profileResult.title;
        if (!publicationUrl) publicationUrl = profileResult.publicationUrl;
        if (!imageUrl) imageUrl = profileResult.imageUrl;
      }

      // Use fallback values if still missing
      if (!title) title = `Script ${scriptSlug}`;
      if (!publicationUrl) publicationUrl = fallbackUrl;

      scriptsToUpsert.push({
        user_id: user_id,
        script_id: pineId,
        pine_id: pineId,
        title: title,
        publication_url: publicationUrl,
        image_url: imageUrl,
        likes: 0,
        reviews_count: 0,
        last_synced_at: new Date().toISOString(),
      });

      console.log(`Script: ${pineId} -> Title: "${title}", URL: ${publicationUrl ? 'found' : 'fallback'}`);
    }

    console.log(`Prepared ${scriptsToUpsert.length} scripts for upsert`);
    console.log(`- With real titles: ${scriptsToUpsert.filter(s => !s.title.startsWith('Script ')).length}`);
    console.log(`- With real URLs: ${scriptsToUpsert.filter(s => !s.publication_url.includes('#published-scripts')).length}`);

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

    const scriptsWithTitles = scriptsToUpsert.filter(s => !s.title.startsWith('Script ')).length;
    const scriptsWithUrls = scriptsToUpsert.filter(s => !s.publication_url.includes('#published-scripts')).length;

    return new Response(JSON.stringify({ 
      message: `Sync complete. Found ${scriptsToUpsert.length} scripts. ${scriptsWithTitles} with titles, ${scriptsWithUrls} with direct URLs.`,
      scripts_count: scriptsToUpsert.length,
      scripts_with_titles: scriptsWithTitles,
      scripts_with_urls: scriptsWithUrls,
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
