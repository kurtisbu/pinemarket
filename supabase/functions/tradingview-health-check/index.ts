import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { DOMParser } from 'https://deno.land/x/deno_dom/deno-dom-wasm.ts';
import { corsHeaders } from '../_shared/cors.ts';

const MAX_BATCH_SIZE = 50;
const INTER_CHECK_DELAY_MS = 5000;
const SKIP_IF_VALIDATED_WITHIN_HOURS = 12;
const COOKIE_EXPIRY_WARNING_DAYS = 25;

async function decrypt(encryptedText: string, key: CryptoKey): Promise<string> {
  const ivAndCiphertext = new Uint8Array(atob(encryptedText).split('').map(c => c.charCodeAt(0)));
  const iv = ivAndCiphertext.slice(0, 12);
  const ciphertext = ivAndCiphertext.slice(12);

  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );

  return new TextDecoder().decode(decryptedBuffer);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const cronSecret = req.headers.get('x-cron-secret');
    const expectedSecret = Deno.env.get('CRON_SECRET');
    if (!expectedSecret || cronSecret !== expectedSecret) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

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

    const { data: sellers, error: sellersError } = await supabaseAdmin
      .from('profiles')
      .select('id, tradingview_username, tradingview_session_cookie, tradingview_signed_session_cookie, tradingview_last_validated_at, tradingview_cookies_set_at')
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
    let skippedCount = 0;
    let expiringWarningCount = 0;
    let rateLimited = false;

    for (const seller of sellers || []) {
      if (checkedCount >= MAX_BATCH_SIZE) {
        console.log(`Reached max batch size of ${MAX_BATCH_SIZE}, stopping`);
        break;
      }

      if (rateLimited) {
        console.log('Rate limited by TradingView, stopping batch');
        break;
      }

      try {
        // Skip if validated recently
        const lastValidated = seller.tradingview_last_validated_at;
        if (lastValidated) {
          const skipThreshold = new Date(Date.now() - SKIP_IF_VALIDATED_WITHIN_HOURS * 60 * 60 * 1000);
          if (new Date(lastValidated) > skipThreshold) {
            skippedCount++;
            continue;
          }
        }

        // Check cookie age for proactive expiry warning
        const cookiesSetAt = seller.tradingview_cookies_set_at;
        if (cookiesSetAt) {
          const cookieAgeDays = (Date.now() - new Date(cookiesSetAt).getTime()) / (1000 * 60 * 60 * 24);
          if (cookieAgeDays >= COOKIE_EXPIRY_WARNING_DAYS) {
            console.log(`Cookies for ${seller.tradingview_username} are ${Math.floor(cookieAgeDays)} days old - marking as expiring_soon`);
            const now = new Date().toISOString();
            await supabaseAdmin
              .from('profiles')
              .update({
                tradingview_connection_status: 'expiring_soon',
                tradingview_last_validated_at: now,
                tradingview_last_error: `Cookies are ${Math.floor(cookieAgeDays)} days old and may expire soon`,
                updated_at: now,
              })
              .eq('id', seller.id);
            expiringWarningCount++;
            // Still proceed to validate the actual connection
          }
        }

        console.log(`Checking connection for seller: ${seller.tradingview_username}`);

        const sessionCookie = await decrypt(seller.tradingview_session_cookie, key);
        const signedSessionCookie = await decrypt(seller.tradingview_signed_session_cookie, key);

        const testUrl = `https://www.tradingview.com/u/${seller.tradingview_username}/#settings-profile`;
        
        const tvResponse = await fetch(testUrl, {
          headers: {
            'Cookie': `sessionid=${sessionCookie}; sessionid_sign=${signedSessionCookie}`,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          },
        });

        // Handle rate limiting
        if (tvResponse.status === 429) {
          console.log(`Rate limited by TradingView (429) while checking ${seller.tradingview_username}`);
          rateLimited = true;
          continue;
        }

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
            // If cookies are old but still valid, keep expiring_soon status
            const cookiesSetAt = seller.tradingview_cookies_set_at;
            if (cookiesSetAt) {
              const cookieAgeDays = (Date.now() - new Date(cookiesSetAt).getTime()) / (1000 * 60 * 60 * 24);
              if (cookieAgeDays >= COOKIE_EXPIRY_WARNING_DAYS) {
                connectionStatus = 'expiring_soon';
                lastError = `Cookies are ${Math.floor(cookieAgeDays)} days old and may expire soon`;
              }
            }
            console.log(`Connection healthy for ${seller.tradingview_username}`);
          }
        }

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

        // Delay between checks to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, INTER_CHECK_DELAY_MS));

      } catch (error) {
        console.error(`Error checking seller ${seller.tradingview_username}:`, error);
        
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
      skipped: skippedCount,
      expired: expiredCount,
      expiring_warnings: expiringWarningCount,
      errors: errorCount,
      rate_limited: rateLimited,
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
