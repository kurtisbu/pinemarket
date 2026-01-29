
import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../../_shared/cors.ts';
import { decrypt } from '../utils/crypto.ts';

interface ScriptAccessEntry {
  pine_id: string;
  username: string;
  expiration?: string;
  created?: string;
}

interface ListUsersResponse {
  results: ScriptAccessEntry[];
  count?: number;
  next?: string;
  previous?: string;
}

/**
 * Fetches all unique Pine IDs owned by the authenticated seller.
 * Uses the list_users endpoint which returns scripts the seller has granted access to.
 * We extract unique Pine IDs from this response.
 */
async function fetchSellerPineIds(
  sessionCookie: string,
  signedSessionCookie: string
): Promise<string[]> {
  const pineIds = new Set<string>();
  let offset = 0;
  const limit = 100;
  let hasMore = true;

  console.log('Fetching seller Pine IDs from list_users endpoint...');

  while (hasMore) {
    const url = `https://www.tradingview.com/pine_perm/list_users/?limit=${limit}&offset=${offset}&order_by=-created`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Origin': 'https://www.tradingview.com',
        'Cookie': `sessionid=${sessionCookie}; sessionid_sign=${signedSessionCookie}`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (!response.ok) {
      console.error(`list_users API returned status: ${response.status}`);
      const errorText = await response.text();
      console.error('Error response:', errorText);
      throw new Error(`Failed to fetch Pine IDs: ${response.status}`);
    }

    const data: ListUsersResponse = await response.json();
    console.log(`Fetched ${data.results?.length || 0} access entries at offset ${offset}`);

    if (data.results && data.results.length > 0) {
      for (const entry of data.results) {
        if (entry.pine_id) {
          pineIds.add(entry.pine_id);
        }
      }
      offset += limit;
      // If we got fewer results than the limit, we've reached the end
      hasMore = data.results.length === limit;
    } else {
      hasMore = false;
    }
  }

  const uniquePineIds = Array.from(pineIds);
  console.log(`Found ${uniquePineIds.length} unique Pine IDs`);
  return uniquePineIds;
}

/**
 * Fetches script metadata from TradingView for a given Pine ID.
 * This is used to get the title and publication URL.
 */
async function fetchScriptMetadata(
  pineId: string,
  sessionCookie: string,
  signedSessionCookie: string
): Promise<{ title: string; publicationUrl: string } | null> {
  try {
    // The Pine ID format is typically "PUB;xxxxx" - we need to extract the script slug
    // For now, we'll use the Pine ID as the identifier and construct a basic title
    // Script details can be fetched from the chart page if needed
    
    // Try to get script info from the publication page
    const scriptSlug = pineId.replace('PUB;', '');
    const publicationUrl = `https://www.tradingview.com/script/${scriptSlug}/`;
    
    // Fetch the script page to get the title
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
    let title = pineId; // Default to Pine ID if we can't extract title
    
    if (titleMatch && titleMatch[1]) {
      // Clean up the title (remove " — Indicator by Username — TradingView" suffix)
      title = titleMatch[1]
        .replace(/\s*[—-]\s*(Indicator|Strategy|Library|Script)\s+by\s+.*/i, '')
        .replace(/\s*[—-]\s*TradingView$/i, '')
        .trim();
    }

    return { title, publicationUrl };
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
    // Step 1: Fetch all Pine IDs owned by this seller
    const pineIds = await fetchSellerPineIds(sessionCookie, signedSessionCookie);

    if (pineIds.length === 0) {
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
        message: `Sync complete. Found 0 scripts. Make sure you have granted access to at least one user for your scripts to appear.`,
        scripts_count: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // Step 2: Fetch metadata for each script (with rate limiting)
    const scripts = [];
    for (const pineId of pineIds) {
      const metadata = await fetchScriptMetadata(pineId, sessionCookie, signedSessionCookie);
      
      const scriptSlug = pineId.replace('PUB;', '');
      
      scripts.push({
        user_id: user_id,
        script_id: pineId,
        pine_id: pineId,
        title: metadata?.title || `Script ${scriptSlug}`,
        publication_url: metadata?.publicationUrl || `https://www.tradingview.com/script/${scriptSlug}/`,
        image_url: null,
        likes: 0,
        reviews_count: 0,
        last_synced_at: new Date().toISOString(),
      });

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    console.log(`Prepared ${scripts.length} scripts for upsert`);

    // Step 3: Upsert scripts to database
    if (scripts.length > 0) {
      const { error: upsertError } = await supabaseAdmin
        .from('tradingview_scripts')
        .upsert(scripts, { onConflict: 'user_id,script_id' });

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
      message: `Sync complete. Found and synced ${scripts.length} scripts for '${profile.tradingview_username}'.`,
      scripts_count: scripts.length
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
