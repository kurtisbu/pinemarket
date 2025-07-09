
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    console.log('[TRIAL-CLEANUP] Starting trial expiration cleanup...');

    // Find all expired trial assignments
    const { data: expiredTrials, error: fetchError } = await supabaseAdmin
      .from('script_assignments')
      .select('*')
      .eq('is_trial', true)
      .eq('status', 'assigned')
      .lt('expires_at', new Date().toISOString());

    if (fetchError) {
      throw new Error(`Failed to fetch expired trials: ${fetchError.message}`);
    }

    console.log(`[TRIAL-CLEANUP] Found ${expiredTrials?.length || 0} expired trials`);

    if (!expiredTrials || expiredTrials.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No expired trials found',
        processed: 0 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    let processedCount = 0;
    let errorCount = 0;

    // Process each expired trial
    for (const trial of expiredTrials) {
      try {
        console.log(`[TRIAL-CLEANUP] Processing expired trial: ${trial.id}`);

        // Update assignment status to expired
        const { error: updateError } = await supabaseAdmin
          .from('script_assignments')
          .update({
            status: 'expired',
            updated_at: new Date().toISOString()
          })
          .eq('id', trial.id);

        if (updateError) {
          console.error(`[TRIAL-CLEANUP] Failed to update trial ${trial.id}:`, updateError);
          errorCount++;
          continue;
        }

        // Try to revoke TradingView access
        if (trial.pine_id && trial.tradingview_username) {
          try {
            const { error: revokeError } = await supabaseAdmin.functions.invoke('tradingview-service', {
              body: {
                action: 'revoke-script-access',
                pine_id: trial.pine_id,
                tradingview_username: trial.tradingview_username,
                assignment_id: trial.id
              }
            });

            if (revokeError) {
              console.warn(`[TRIAL-CLEANUP] Failed to revoke TradingView access for trial ${trial.id}:`, revokeError);
              // Don't fail the whole process if TradingView revocation fails
            }
          } catch (tvError) {
            console.warn(`[TRIAL-CLEANUP] TradingView revocation error for trial ${trial.id}:`, tvError);
          }
        }

        processedCount++;
        console.log(`[TRIAL-CLEANUP] Successfully processed trial: ${trial.id}`);

      } catch (error) {
        console.error(`[TRIAL-CLEANUP] Error processing trial ${trial.id}:`, error);
        errorCount++;
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Trial cleanup completed`,
      processed: processedCount,
      errors: errorCount,
      total: expiredTrials.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('[TRIAL-CLEANUP] Error in trial cleanup:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
