// Posts platform activity alerts to Discord.
// Events: signup, seller_onboarded, program_published
// Called from Postgres triggers via pg_net; authorized with x-alert-secret.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-alert-secret',
};

const FALLBACK_WEBHOOK_URL = Deno.env.get('DISCORD_SUPPORT_WEBHOOK_URL') || '';
const SIGNUP_WEBHOOK_URL = Deno.env.get('DISCORD_SIGNUP_WEBHOOK_URL') || FALLBACK_WEBHOOK_URL;
const SELLER_WEBHOOK_URL = Deno.env.get('DISCORD_SELLER_WEBHOOK_URL') || FALLBACK_WEBHOOK_URL;
const PRODUCT_WEBHOOK_URL = Deno.env.get('DISCORD_PRODUCT_WEBHOOK_URL') || FALLBACK_WEBHOOK_URL;
const ALERT_SECRET = Deno.env.get('DISCORD_ALERT_SECRET') || '';
const APP_URL = Deno.env.get('APP_URL') || 'https://pinemarket.io';

type EventKind = 'signup' | 'seller_onboarded' | 'program_published';

interface Payload {
  event: EventKind;
  username?: string | null;
  display_name?: string | null;
  user_id?: string | null;
  program_id?: string | null;
  program_title?: string | null;
  category?: string | null;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    if (!ALERT_SECRET || req.headers.get('x-alert-secret') !== ALERT_SECRET) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const p = (await req.json()) as Payload;
    if (!p?.event) {
      return new Response(JSON.stringify({ error: 'event required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const who = p.display_name || p.username || 'Unknown';
    const profileLink = p.username ? `${APP_URL}/profile/${p.username}` : `${APP_URL}/admin`;

    let title = '';
    let color = 0x64748b;
    let url = profileLink;
    const fields: { name: string; value: string; inline?: boolean }[] = [];
    let webhookUrl = FALLBACK_WEBHOOK_URL;

    if (p.event === 'signup') {
      title = `👋 New signup: ${who}`;
      color = 0x22c55e;
      fields.push({ name: 'Username', value: p.username || '—', inline: true });
      webhookUrl = SIGNUP_WEBHOOK_URL;
    } else if (p.event === 'seller_onboarded') {
      title = `🚀 Seller onboarded: ${who}`;
      color = 0x8b5cf6;
      fields.push({ name: 'Username', value: p.username || '—', inline: true });
      fields.push({ name: 'Profile', value: profileLink, inline: false });
      webhookUrl = SELLER_WEBHOOK_URL;
    } else if (p.event === 'program_published') {
      title = `📦 Program published: ${p.program_title || 'Untitled'}`;
      color = 0x3b82f6;
      url = p.program_id ? `${APP_URL}/program/${p.program_id}` : profileLink;
      fields.push({ name: 'Seller', value: who, inline: true });
      if (p.category) fields.push({ name: 'Category', value: p.category, inline: true });
      fields.push({ name: 'Link', value: url, inline: false });
      webhookUrl = PRODUCT_WEBHOOK_URL;
    }

    if (!webhookUrl) {
      return new Response(JSON.stringify({ ok: true, skipped: 'no webhook configured for event' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'PineMarket Activity',
        embeds: [{ title, url, color, fields, timestamp: new Date().toISOString() }],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error('Discord webhook failed', res.status, body);
      return new Response(JSON.stringify({ ok: false, status: res.status, body }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('discord-alerts error', err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});