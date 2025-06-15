import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../../_shared/cors.ts';
import { decrypt } from '../utils/crypto.ts';

export async function syncUserScripts(
  payload: any,
  supabaseAdmin: SupabaseClient,
  key: CryptoKey
): Promise<Response> {
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

  // Step 1: Fetch profile page to get numeric user ID
  const profilePageUrl = `https://www.tradingview.com/u/${profile.tradingview_username}/`;
  console.log(`Fetching profile page to find numeric user ID: ${profilePageUrl}`);

  const profilePageResponse = await fetch(profilePageUrl, {
    headers: { 
      'Cookie': `sessionid=${sessionCookie}; sessionid_sign=${signedSessionCookie}`,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    },
  });

  if (!profilePageResponse.ok) {
    return new Response(JSON.stringify({ error: `Failed to fetch TradingView profile page (status: ${profilePageResponse.status})` }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
  }

  const profilePageHtml = await profilePageResponse.text();

  // Step 2: Extract numeric user ID from HTML
  // The previous regex /"user_id":\s*(\d+)/ is no longer reliable.
  // Let's try to find the ID associated with the username from a JSON object in the HTML.
  const escapedUsername = profile.tradingview_username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const userIdRegex = new RegExp(`"id":\\s*(\\d+),\\s*"username":\\s*"${escapedUsername}"`, "i");
  
  let numericUserId: string | null = null;
  const userIdMatch = profilePageHtml.match(userIdRegex);
  
  if (userIdMatch && userIdMatch[1]) {
    numericUserId = userIdMatch[1];
  } else {
    // Fallback to the old regex just in case.
    const oldUserIdMatch = profilePageHtml.match(/"user_id":\s*(\d+)/);
    if (oldUserIdMatch && oldUserIdMatch[1]) {
      numericUserId = oldUserIdMatch[1];
    }
  }

  if (!numericUserId) {
    console.error("Could not find numeric user ID in profile page HTML after trying multiple patterns.");
    // Log a portion of the HTML for easier debugging without leaking too much.
    console.error("HTML snippet:", profilePageHtml.substring(0, 3000));
    return new Response(JSON.stringify({ error: 'Could not determine TradingView numeric user ID. This may be due to a recent change on TradingView\'s website. Please try again later.' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
  }

  console.log(`Found numeric user ID: ${numericUserId} for username: ${profile.tradingview_username}`);
  
  // Step 3: Fetch scripts from the API endpoint
  const scriptsApiUrl = `https://www.tradingview.com/api/v1/user/profile/charts/?script_type=all&access_script=all&privacy_script=all&by=${numericUserId}&q=`;
  console.log(`Fetching scripts from TradingView API: ${scriptsApiUrl}`);

  const tvResponse = await fetch(scriptsApiUrl, {
    headers: { 
      'Cookie': `sessionid=${sessionCookie}; sessionid_sign=${signedSessionCookie}`,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    },
  });

  console.log(`TradingView API call for ${profile.tradingview_username} - Status: ${tvResponse.status}`);
  
  if (!tvResponse.ok) {
    if (tvResponse.status === 404) {
       return new Response(JSON.stringify({ error: `TradingView user '${profile.tradingview_username}' (ID: ${numericUserId}) not found via API.` }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
    }
    const errorText = await tvResponse.text();
    console.error("TradingView API Error Response:", errorText);
    return new Response(JSON.stringify({ error: `Failed to fetch scripts from TradingView API (status: ${tvResponse.status})` }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
  }

  // Step 4: Parse JSON response
  const apiData = await tvResponse.json();
  const scriptsData = apiData.results || [];

  if (scriptsData.length === 0) {
    return new Response(JSON.stringify({ message: `Sync complete. Found 0 public scripts for '${profile.tradingview_username}'. Check if you have published scripts and they are public.` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  }
  
  // Step 5: Map API data to our database schema
  const scripts = scriptsData.map((script: any) => {
      const publicationUrl = `https://www.tradingview.com${script.url}`;
      
      const scriptIdMatch = publicationUrl.match(/\/script\/([^\/]+)\//);
      // Use the private script ID as a fallback if regex fails
      const scriptId = scriptIdMatch ? scriptIdMatch[1] : script.script_id_private;
      
      return {
        user_id: user_id,
        script_id: scriptId,
        title: script.script_name || 'Untitled',
        publication_url: publicationUrl,
        image_url: script.image_url,
        likes: script.likes_count || 0,
        reviews_count: script.reviews_count || 0,
        last_synced_at: new Date().toISOString(),
      };
    }).filter((script: any) => script.publication_url.includes('/script/'));
  
  console.log(`Successfully parsed ${scripts.length} scripts from API.`);

  if (scripts.length > 0) {
    const { error: upsertError } = await supabaseAdmin
      .from('tradingview_scripts')
      .upsert(scripts, { onConflict: 'user_id,script_id' });
    
    if (upsertError) throw upsertError;
  }

  return new Response(JSON.stringify({ message: `Sync complete. Found and upserted ${scripts.length} scripts for '${profile.tradingview_username}'.` }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status: 200,
  });
}
