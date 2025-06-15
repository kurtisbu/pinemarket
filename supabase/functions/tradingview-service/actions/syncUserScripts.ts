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
  const escapedUsername = profile.tradingview_username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const userIdRegex = new RegExp(`"id":\\s*(\\d+),\\s*"username":\\s*"${escapedUsername}"`, "i");
  
  let numericUserId: string | null = null;
  const userIdMatch = profilePageHtml.match(userIdRegex);
  
  if (userIdMatch && userIdMatch[1]) {
    numericUserId = userIdMatch[1];
  } else {
    // Fallback to the old regex just in case.
    const oldUserIdMatch = profilePageHtml.match(/"user_id":\\s*(\d+)/);
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
  const scriptsApiUrl = `https://www.tradingview.com/api/v1/user/profile/charts/?script_type=all&access_script=all&privacy_script=all&by=${numericUserId}&q=&script_access=invite-only-open`;
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

  // Step 4: Parse response and extract scripts
  let apiData;
  let responseTextForHtmlParsing = '';

  try {
    const responseText = await tvResponse.text();
    responseTextForHtmlParsing = responseText;
    apiData = JSON.parse(responseText);
  } catch (e) {
    console.log("Could not parse TradingView API response as JSON, assuming HTML content.");
    apiData = { html: responseTextForHtmlParsing };
  }
  
  console.log("Raw TradingView API Data (snippet):", JSON.stringify(apiData, null, 2).substring(0, 500));

  let scriptsData: any[] = [];
  
  if (apiData && apiData.html && typeof apiData.html === 'string') {
    console.log("Parsing HTML content from TradingView API response based on Python script logic.");
    const htmlContent = apiData.html;
    
    // Based on your python script: soup.find_all('div', class_='tv-feed-layout__card-item')
    const scriptCards = htmlContent.split(/class="tv-feed-layout__card-item/);

    const parseCount = (text: string | null | undefined): number => {
        if (!text) return 0;
        const lowerText = text.toLowerCase().replace(/,/g, '');
        const num = parseFloat(lowerText);
        if (isNaN(num)) return 0;

        if (lowerText.includes('k')) {
            return Math.round(num * 1000);
        }
        if (lowerText.includes('m')) {
            return Math.round(num * 1000000);
        }
        return Math.round(num);
    };

    if (scriptCards.length > 1) {
        console.log(`Found ${scriptCards.length - 1} script cards.`);
        scriptCards.slice(1).forEach(cardHtml => {
            const titleRegex = /<a[^>]+class="[^"]*tv-widget-idea__title[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/;
            const likesRegex = /<span[^>]+data-name="agrees"[^>]*>[\s\S]*?<span[^>]+class="[^"]*tv-card-social-item__count[^"]*"[^>]*>([^<]+)<\/span>/;
            const commentsRegex = /<span[^>]+data-name="comments"[^>]*>[\s\S]*?<span[^>]+class="[^"]*tv-card-social-item__count[^"]*"[^>]*>([^<]+)<\/span>/;
            const imageRegex = /<img[^>]+class="[^"]*tv-widget-idea__image[^"]*"[^>]+src="([^"]+)"/;

            const titleMatch = cardHtml.match(titleRegex);
            const likesMatch = cardHtml.match(likesRegex);
            const commentsMatch = cardHtml.match(commentsRegex);
            const imageMatch = cardHtml.match(imageRegex);

            if (titleMatch && titleMatch[1] && titleMatch[2]) {
                const scriptUrl = "https://www.tradingview.com" + titleMatch[1];
                const scriptTitle = titleMatch[2].replace(/<[^>]*>?/gm, '').trim();
                
                const likesCount = parseCount(likesMatch ? likesMatch[1] : '0');
                const commentsCount = parseCount(commentsMatch ? commentsMatch[1] : '0');
                const imageUrl = imageMatch ? imageMatch[1] : null;

                console.log(`Parsed Script: Title=${scriptTitle}, Likes=${likesCount}, URL=${scriptUrl}`);

                scriptsData.push({
                    script_name: scriptTitle,
                    url: scriptUrl,
                    image_url: imageUrl,
                    likes_count: likesCount,
                    reviews_count: commentsCount,
                    script_id_private: null // Not available with this scraping method
                });
            }
        });
    } else {
        console.log("Could not find any script cards with class 'tv-feed-layout__card-item'. HTML structure has likely changed again.");
    }
  } else if (apiData && apiData.results) {
    console.log("Parsing JSON 'results' from TradingView API response.");
    if (Array.isArray(apiData.results)) {
      scriptsData = apiData.results;
    } else if (typeof apiData.results === 'object' && apiData.results !== null) {
      scriptsData = Object.values(apiData.results);
    }
  }

  if (scriptsData.length === 0) {
    return new Response(JSON.stringify({ message: `Sync complete. Found 0 scripts for '${profile.tradingview_username}'. Check if you have published scripts.` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  }
  
  // Step 5: Map API data to our database schema
  const scripts = scriptsData.map((script: any) => {
      const publicationUrl = script.url.startsWith('http') ? script.url : `https://www.tradingview.com${script.url}`;
      
      const scriptIdMatch = publicationUrl.match(/\/script\/([^\/]+)\//);
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
