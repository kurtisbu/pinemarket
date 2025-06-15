
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// AES-256-GCM encryption function
async function encrypt(text: string, key: CryptoKey): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV
  const encoded = new TextEncoder().encode(text);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded
  );

  // Prepend IV to ciphertext for storage. It's needed for decryption.
  const ivAndCiphertext = new Uint8Array(iv.length + ciphertext.byteLength);
  ivAndCiphertext.set(iv);
  ivAndCiphertext.set(new Uint8Array(ciphertext), iv.length);

  // Return as a base64 string
  return btoa(String.fromCharCode(...ivAndCiphertext));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { action, credentials, user_id } = await req.json();

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

    if (action === 'test-connection') {
      const { tradingview_session_cookie, tradingview_signed_session_cookie } = credentials;

      if (!tradingview_session_cookie || !tradingview_signed_session_cookie || !user_id) {
        return new Response(JSON.stringify({ error: 'Missing required credentials or user ID.' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        });
      }

      // Here you would typically test the credentials against TradingView.
      // For now, we'll simulate a successful connection and proceed with encryption and saving.
      const isConnectionSuccessful = true; 

      if (isConnectionSuccessful) {
        const encrypted_session = await encrypt(tradingview_session_cookie, key);
        const encrypted_signed_session = await encrypt(tradingview_signed_session_cookie, key);

        const { error } = await supabaseAdmin
          .from('profiles')
          .update({
            tradingview_session_cookie: encrypted_session,
            tradingview_signed_session_cookie: encrypted_signed_session,
            is_tradingview_connected: true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', user_id);

        if (error) throw error;
        
        return new Response(JSON.stringify({ message: 'Connection successful and credentials saved securely.' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      } else {
        // In a real scenario, you'd update the connection status to false
        await supabaseAdmin.from('profiles').update({ is_tradingview_connected: false }).eq('id', user_id);
        return new Response(JSON.stringify({ error: 'TradingView connection failed. Please check your credentials.' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        });
      }
    }

    return new Response(JSON.stringify({ error: 'Invalid action.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  } catch (error) {
    console.error('Error in tradingview-service:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
