
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
 * Fetches script metadata from TradingView for a given Pine ID.
 */
async function fetchScriptMetadata(
  pineId: string,
  sessionCookie: string,
  signedSessionCookie: string
): Promise<{ title: string; publicationUrl: string; imageUrl: string | null } | null> {
  try {
    // Extract script slug from Pine ID (format: "PUB;xxxxx")
    const scriptSlug = pineId.replace('PUB;', '');
    const publicationUrl = `https://www.tradingview.com/script/${scriptSlug}/`;
    
    const response = await fetch(publicationUrl, {
      method: 'GET',
      headers: {
        'Cookie': `sessionid=${sessionCookie}; sessionid_sign=${signedSessionCookie}`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (!response.ok) {
      console.log(`Could not fetch metadata for ${pineId}: ${response.status}`);
      return null;
    }

    const html = await response.text();
    
    // Extract title from the page
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    let title = `Script ${scriptSlug}`;
    
    if (titleMatch && titleMatch[1]) {
      title = titleMatch[1]
        .replace(/\s*[—-]\s*(Indicator|Strategy|Library|Script)\s+by\s+.*/i, '')
        .replace(/\s*[—-]\s*TradingView$/i, '')
        .trim();
    }

    // Try to extract image URL
    let imageUrl: string | null = null;
    const ogImageMatch = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i);
    if (ogImageMatch && ogImageMatch[1]) {
      imageUrl = ogImageMatch[1];
    }

    return { title, publicationUrl, imageUrl };
  } catch (error) {
    console.error(`Error fetching metadata for ${pineId}:`, error);
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

    // Step 2: Fetch metadata for each script
    const scriptsToUpsert = [];
    
    for (const pineId of pineIds) {
      const scriptSlug = pineId.replace('PUB;', '');
      const metadata = await fetchScriptMetadata(pineId, sessionCookie, signedSessionCookie);
      
      scriptsToUpsert.push({
        user_id: user_id,
        script_id: pineId,
        pine_id: pineId,
        title: metadata?.title || `Script ${scriptSlug}`,
        publication_url: metadata?.publicationUrl || `https://www.tradingview.com/script/${scriptSlug}/`,
        image_url: metadata?.imageUrl || null,
        likes: 0,
        reviews_count: 0,
        last_synced_at: new Date().toISOString(),
      });

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
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
