import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../../_shared/cors.ts';

export async function disconnectTradingView(
  payload: any,
  supabaseAdmin: SupabaseClient
): Promise<Response> {
  const { user_id } = payload;

  if (!user_id) {
    return new Response(
      JSON.stringify({ error: 'user_id is required' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }

  console.log(`[DISCONNECT] Starting disconnect for user: ${user_id}`);

  try {
    // Delete all synced scripts for this user
    const { error: deleteScriptsError } = await supabaseAdmin
      .from('tradingview_scripts')
      .delete()
      .eq('user_id', user_id);

    if (deleteScriptsError) {
      console.error('[DISCONNECT] Error deleting scripts:', deleteScriptsError);
      throw deleteScriptsError;
    }

    console.log('[DISCONNECT] Deleted synced scripts');

    // Disconnect TradingView from profile
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        tradingview_username: null,
        is_tradingview_connected: false,
        tradingview_connection_status: null,
        tradingview_session_cookie: null,
        tradingview_signed_session_cookie: null,
        tradingview_last_validated_at: null,
        tradingview_last_error: null,
      })
      .eq('id', user_id);

    if (updateError) {
      console.error('[DISCONNECT] Error updating profile:', updateError);
      throw updateError;
    }

    console.log('[DISCONNECT] Profile disconnected successfully');

    // Set all published programs to draft
    const { error: programsError } = await supabaseAdmin
      .from('programs')
      .update({ status: 'draft' })
      .eq('seller_id', user_id)
      .eq('status', 'published');

    if (programsError) {
      console.error('[DISCONNECT] Error updating programs:', programsError);
      // Don't throw - this is not critical
    } else {
      console.log('[DISCONNECT] Programs set to draft');
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'TradingView account disconnected successfully',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('[DISCONNECT] Error:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'Failed to disconnect TradingView account',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
}
