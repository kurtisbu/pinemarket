
import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { DOMParser } from 'https://deno.land/x/deno_dom/deno-dom-wasm.ts';
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

  const scriptsPageUrl = `https://www.tradingview.com/u/${profile.tradingview_username}/#published-scripts`;
  
  console.log(`Fetching scripts from TradingView page: ${scriptsPageUrl}`);

  const tvResponse = await fetch(scriptsPageUrl, {
    headers: { 
      'Cookie': `sessionid=${sessionCookie}; sessionid_sign=${signedSessionCookie}`,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    },
  });

  console.log(`TradingView page scrape for ${profile.tradingview_username} - Status: ${tvResponse.status}`);
  
  if (!tvResponse.ok) {
    if (tvResponse.status === 404) {
       return new Response(JSON.stringify({ error: `TradingView user '${profile.tradingview_username}' not found. Please check your username.` }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
    }
    const errorText = await tvResponse.text();
    console.error("TradingView Page Scrape Error Response:", errorText);
    return new Response(JSON.stringify({ error: `Failed to fetch scripts page from TradingView (status: ${tvResponse.status})` }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
  }

  const html = await tvResponse.text();
  const doc = new DOMParser().parseFromString(html, 'text/html');

  if (!doc) {
    return new Response(JSON.stringify({ error: 'Failed to parse TradingView page HTML.' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
  }

  const scriptElements = doc.querySelectorAll('.tv-widget-idea');
  
  console.log(`Found ${scriptElements.length} potential script elements on page.`);

  if (scriptElements.length === 0) {
    return new Response(JSON.stringify({ message: `Sync complete. Found 0 public scripts for '${profile.tradingview_username}'. Check if you have published scripts and they are public.` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  }
  
  const scripts = Array.from(scriptElements).map((el: any) => {
      const titleEl = el.querySelector('a.tv-widget-idea__title');
      const title = titleEl?.textContent?.trim() || 'Untitled';
      const publicationUrl = `https://www.tradingview.com${titleEl?.getAttribute('href') || ''}`;
      
      const scriptIdMatch = publicationUrl.match(/\/script\/([^\/]+)\//);
      const scriptId = scriptIdMatch ? scriptIdMatch[1] : `unknown-${Math.random()}`;
      
      const imageEl = el.querySelector('img.tv-widget-idea__cover-img');
      const imageUrl = imageEl?.getAttribute('src');

      const likesEl = el.querySelector('span[data-role="likes-count"]');
      const likes = parseInt(likesEl?.textContent || '0', 10);

      const commentsEl = el.querySelector('span[data-role="comments-count"]');
      const reviews_count = parseInt(commentsEl?.textContent || '0', 10);

      return {
        user_id: user_id,
        script_id: scriptId,
        title: title,
        publication_url: publicationUrl,
        image_url: imageUrl,
        likes: likes || 0,
        reviews_count: reviews_count || 0,
        last_synced_at: new Date().toISOString(),
      };
    }).filter((script: any) => script.publication_url.includes('/script/'));
  
  console.log(`Successfully parsed ${scripts.length} scripts.`);

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
