
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

  const scriptsApiUrl = `https://www.tradingview.com/publish/history/${profile.tradingview_username}/?sort=recent&page=1`;
  
  console.log(`Fetching scripts from TradingView API: ${scriptsApiUrl}`);

  const tvResponse = await fetch(scriptsApiUrl, {
    headers: { 
      'Cookie': `sessionid=${sessionCookie}; sessionid_sign=${signedSessionCookie}`,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'X-Requested-With': 'XMLHttpRequest',
    },
  });

  console.log(`TradingView API fetch for ${profile.tradingview_username} - Status: ${tvResponse.status}`);
  
  if (!tvResponse.ok) {
    if (tvResponse.status === 404) {
       return new Response(JSON.stringify({ error: `TradingView user '${profile.tradingview_username}' not found or has no public scripts. Please check your username or script visibility.` }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
    }
    const errorText = await tvResponse.text();
    console.error("TradingView API Error Response:", errorText);
    return new Response(JSON.stringify({ error: `Failed to fetch scripts from TradingView API (status: ${tvResponse.status})` }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
  }

  const responseData = await tvResponse.json();
  const publications = responseData.results?.publications || [];
  
  console.log(`Found ${publications.length} publications in API response.`);

  if (publications.length === 0) {
    return new Response(JSON.stringify({ message: `Sync complete. Found 0 public scripts for '${profile.tradingview_username}'.` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  }
  
  const scripts = publications.map((p: any) => ({
      user_id: user_id,
      script_id: p.script_id_name,
      title: p.name,
      publication_url: `https://www.tradingview.com${p.link}`,
      image_url: p.image_url,
      likes: p.likes_count || 0,
      reviews_count: p.reviews_count || 0,
      last_synced_at: new Date().toISOString(),
  }));
  
  if (scripts.length > 0) {
    const { error: upsertError } = await supabaseAdmin
      .from('tradingview_scripts')
      .upsert(scripts, { onConflict: 'user_id,script_id' });
    
    if (upsertError) throw upsertError;
  }

  return new Response(JSON.stringify({ message: `Sync complete. Found ${scripts.length} scripts for '${profile.tradingview_username}'.` }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status: 200,
  });
}
