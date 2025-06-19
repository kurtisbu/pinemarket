
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
    console.log("=== DEBUG: Starting HTML parsing ===");
    const htmlContent = apiData.html;
    console.log(`HTML Content Length: ${htmlContent.length}`);
    
    // Log first 1000 characters to see the structure
    console.log("HTML Structure (first 1000 chars):", htmlContent.substring(0, 1000));

    // Try multiple regex patterns based on what we see in the logs
    const patterns = [
      // Pattern 1: Both classes together (most specific)
      /<div[^>]+class="[^"]*tv-feed__item[^"]*tv-feed-layout__card-item[^"]*"[^>]*>[\s\S]*?(?=<div[^>]+class="[^"]*tv-feed__item[^"]*tv-feed-layout__card-item|$)/g,
      // Pattern 2: Either class (broader)
      /<div[^>]+class="[^"]*tv-feed-layout__card-item[^"]*"[^>]*>[\s\S]*?(?=<div[^>]+class="[^"]*tv-feed-layout__card-item|$)/g,
      // Pattern 3: Just the feed item class
      /<div[^>]+class="[^"]*tv-feed__item[^"]*"[^>]*>[\s\S]*?(?=<div[^>]+class="[^"]*tv-feed__item|$)/g
    ];

    let scriptCards: string[] = [];
    let patternUsed = -1;
    
    for (let i = 0; i < patterns.length; i++) {
      console.log(`Trying pattern ${i + 1}...`);
      scriptCards = htmlContent.match(patterns[i]) || [];
      if (scriptCards.length > 0) {
        console.log(`SUCCESS: Pattern ${i + 1} found ${scriptCards.length} cards`);
        patternUsed = i;
        break;
      }
    }
    
    if (scriptCards.length === 0) {
      console.log("FALLBACK: Trying simple div split approach...");
      const divSections = htmlContent.split(/<div[^>]*>/);
      console.log(`Found ${divSections.length} div sections`);
      
      // Look for sections that contain script-like content
      scriptCards = divSections.filter(section => 
        section.includes('tv-widget-idea__title') || 
        section.includes('published_chart_url') ||
        section.includes('/script/')
      );
      console.log(`Found ${scriptCards.length} potential script sections using fallback`);
    }

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

    if (scriptCards.length > 0) {
        console.log(`Processing ${scriptCards.length} script cards...`);
        
        scriptCards.forEach((cardHtml, index) => {
            console.log(`--- Processing card ${index + 1} ---`);
            console.log(`Card HTML snippet (first 200 chars):`, cardHtml.substring(0, 200));
            
            // Multiple approaches to find the title and URL
            const titlePatterns = [
              // Pattern 1: tv-widget-idea__title class
              /<a[^>]+class="[^"]*tv-widget-idea__title[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/,
              // Pattern 2: Look for /script/ links directly
              /<a[^>]+href="([^"]*\/script\/[^"]*)"[^>]*>([\s\S]*?)<\/a>/,
              // Pattern 3: Look in data attributes
              /published_chart_url[^:]*:\s*"([^"]+)"[^}]*name[^:]*:\s*"([^"]+)"/
            ];

            let titleMatch = null;
            let patternIndex = -1;
            
            for (let i = 0; i < titlePatterns.length; i++) {
              titleMatch = cardHtml.match(titlePatterns[i]);
              if (titleMatch && titleMatch[1]) {
                console.log(`Title found using pattern ${i + 1}: URL=${titleMatch[1]}, Title=${titleMatch[2] || 'N/A'}`);
                patternIndex = i;
                break;
              }
            }
            
            // Look for likes count
            const likesPatterns = [
              /<span[^>]+data-name="agrees"[^>]*>[\s\S]*?<span[^>]+class="[^"]*tv-card-social-item__count[^"]*"[^>]*>([^<]+)<\/span>/,
              /data-name="agrees"[^>]*>[\s\S]*?(\d+)/,
              /"agrees":\s*(\d+)/
            ];
            
            let likesMatch = null;
            for (const pattern of likesPatterns) {
              likesMatch = cardHtml.match(pattern);
              if (likesMatch && likesMatch[1]) {
                console.log(`Likes found: ${likesMatch[1]}`);
                break;
              }
            }

            if (titleMatch && titleMatch[1]) {
                let scriptUrl = titleMatch[1];
                if (!scriptUrl.startsWith('http')) {
                  scriptUrl = "https://www.tradingview.com" + scriptUrl;
                }
                
                let scriptTitle = titleMatch[2] || 'Untitled Script';
                if (patternIndex === 2) {
                  // For data attribute pattern, title is in position 2
                  scriptTitle = titleMatch[2] || 'Untitled Script';
                }
                
                scriptTitle = scriptTitle.replace(/<[^>]*>/g, '').trim();
                const likesCount = parseCount(likesMatch ? likesMatch[1] : '0');

                // Extract pine_id from URL (between /script/ and /)
                const pineIdMatch = scriptUrl.match(/\/script\/([^\/]+)\//);
                const pineId = pineIdMatch ? pineIdMatch[1] : null;

                console.log(`✓ Successfully parsed: Title="${scriptTitle}", Likes=${likesCount}, URL=${scriptUrl}, Pine ID=${pineId}`);

                scriptsData.push({
                    script_name: scriptTitle,
                    url: scriptUrl,
                    image_url: null,
                    likes_count: likesCount,
                    reviews_count: 0,
                    script_id_private: null,
                    pine_id: pineId
                });
            } else {
               console.log(`✗ Could not extract script info from card ${index + 1}`);
               console.log(`Card content (first 500 chars):`, cardHtml.substring(0, 500));
            }
        });
    } else {
        console.log("ERROR: No script cards found with any pattern");
        console.log("Searching for any /script/ URLs in the HTML...");
        const scriptUrlMatches = htmlContent.match(/\/script\/[^"'\s>]+/g) || [];
        console.log(`Found ${scriptUrlMatches.length} script URLs:`, scriptUrlMatches.slice(0, 5));
        
        console.log("Searching for tv-widget-idea__title classes...");
        const titleMatches = htmlContent.match(/tv-widget-idea__title/g) || [];
        console.log(`Found ${titleMatches.length} title elements`);
        
        console.log("Searching for any div classes containing 'card' or 'item'...");
        const cardClassMatches = htmlContent.match(/class="[^"]*(?:card|item)[^"]*"/g) || [];
        console.log(`Found ${cardClassMatches.length} potential card classes:`, cardClassMatches.slice(0, 10));
    }
  } else if (apiData && apiData.results) {
    console.log("Parsing JSON 'results' from TradingView API response.");
    if (Array.isArray(apiData.results)) {
      scriptsData = apiData.results;
    } else if (typeof apiData.results === 'object' && apiData.results !== null) {
      scriptsData = Object.values(apiData.results);
    }
  }

  console.log(`=== FINAL RESULT: Found ${scriptsData.length} scripts ===`);

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
        pine_id: script.pine_id || scriptId, // Use pine_id if available, fallback to script_id
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
