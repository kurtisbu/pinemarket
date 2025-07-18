
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { DOMParser } from 'https://deno.land/x/deno_dom/deno-dom-wasm.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { decrypt } from '../tradingview-service/utils/crypto.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );
    
    const encryptionKeyString = Deno.env.get('TRADINGVIEW_ENCRYPTION_KEY');
    if (!encryptionKeyString) {
      throw new Error('TRADINGVIEW_ENCRYPTION_KEY is not set.');
    }

    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(encryptionKeyString),
      'AES-GCM',
      true,
      ['encrypt', 'decrypt']
    );

    console.log('Starting TradingView health check...');

    // Get all sellers with TradingView connections
    const { data: sellers, error: sellersError } = await supabaseAdmin
      .from('profiles')
      .select('id, tradingview_username, tradingview_session_cookie, tradingview_signed_session_cookie, tradingview_last_validated_at')
      .eq('is_tradingview_connected', true)
      .not('tradingview_session_cookie', 'is', null)
      .not('tradingview_signed_session_cookie', 'is', null);

    if (sellersError) {
      console.error('Error fetching sellers:', sellersError);
      throw sellersError;
    }

    console.log(`Found ${sellers?.length || 0} sellers to check`);

    let checkedCount = 0;
    let expiredCount = 0;
    let errorCount = 0;

    for (const seller of sellers || []) {
      try {
        // Skip if validated recently (within last 6 hours)
        const lastValidated = seller.tradingview_last_validated_at;
        if (lastValidated) {
          const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
          if (new Date(lastValidated) > sixHoursAgo) {
            console.log(`Skipping ${seller.tradingview_username} - validated recently`);
            continue;
          }
        }

        console.log(`Checking connection for seller: ${seller.tradingview_username}`);

        // Decrypt session cookies
        const sessionCookie = await decrypt(seller.tradingview_session_cookie, key);
        const signedSessionCookie = await decrypt(seller.tradingview_signed_session_cookie, key);

        // Test connection
        const testUrl = `https://www.tradingview.com/u/${seller.tradingview_username}/#settings-profile`;
        
        const tvResponse = await fetch(testUrl, {
          headers: {
            'Cookie': `sessionid=${sessionCookie}; sessionid_sign=${signedSessionCookie}`,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          },
        });

        const now = new Date().toISOString();
        let connectionStatus = 'active';
        let lastError = null;

        if (!tvResponse.ok) {
          connectionStatus = 'expired';
          lastError = `HTTP ${tvResponse.status}: Connection failed`;
          expiredCount++;
          console.log(`Connection expired for ${seller.tradingview_username}: ${lastError}`);
        } else {
          const html = await tvResponse.text();
          const doc = new DOMParser().parseFromString(html, 'text/html');
          const isAuthenticated = doc?.querySelector('html')?.classList.contains('is-authenticated');

          if (!isAuthenticated) {
            connectionStatus = 'expired';
            lastError = 'Authentication failed - cookies expired';
            expiredCount++;
            console.log(`Authentication failed for ${seller.tradingview_username}`);
          } else {
            console.log(`Connection healthy for ${seller.tradingview_username}`);
          }
        }

        // Update seller's connection status
        await supabaseAdmin
          .from('profiles')
          .update({
            tradingview_connection_status: connectionStatus,
            tradingview_last_validated_at: now,
            tradingview_last_error: lastError,
            updated_at: now,
          })
          .eq('id', seller.id);

        checkedCount++;

        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (error) {
        console.error(`Error checking seller ${seller.tradingview_username}:`, error);
        
        // Update with error status
        await supabaseAdmin
          .from('profiles')
          .update({
            tradingview_connection_status: 'error',
            tradingview_last_validated_at: new Date().toISOString(),
            tradingview_last_error: error.message,
            updated_at: new Date().toISOString(),
          })
          .eq('id', seller.id);

        errorCount++;
      }
    }

    // Disable programs for expired connections
    await supabaseAdmin.rpc('disable_programs_for_expired_connections');

    const summary = {
      total_sellers: sellers?.length || 0,
      checked: checkedCount,
      expired: expiredCount,
      errors: errorCount,
      timestamp: new Date().toISOString()
    };

    console.log('Health check completed:', summary);

    return new Response(JSON.stringify({ 
      message: 'Health check completed',
      ...summary
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Health check error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
