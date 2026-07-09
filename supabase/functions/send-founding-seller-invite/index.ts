// Sends a founding-seller invite email via Resend (gateway).
// Admin-only. Requires the caller to be authenticated and have the admin role.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders } from '../_shared/cors.ts';

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/resend';
const FROM_ADDRESS = Deno.env.get('INVITE_FROM_ADDRESS') || 'PineMarket <invites@notify.pinemarket.io>';
const APP_URL = Deno.env.get('APP_URL') || 'https://pinemarket.io';

interface Payload {
  recipientEmail: string;
  firstName?: string;
  accessCode?: string;
  tradingviewUsername?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (!LOVABLE_API_KEY || !RESEND_API_KEY) {
      throw new Error('Email service is not configured');
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) return json({ error: 'Unauthorized' }, 401);

    const { data: isAdmin, error: roleErr } = await supabase.rpc('has_role', {
      _user_id: userData.user.id,
      _role: 'admin',
    });
    if (roleErr || !isAdmin) return json({ error: 'Forbidden' }, 403);

    const body = (await req.json()) as Payload;
    const email = (body.recipientEmail || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ error: 'Valid recipientEmail required' }, 400);
    }

    const firstName = (body.firstName || '').trim() || 'there';
    const accessCode = (body.accessCode || '').trim();
    const signupUrl = `${APP_URL}/auth?sell=1${accessCode ? `&code=${encodeURIComponent(accessCode)}` : ''}`;

    const subject = "You're invited: become a founding seller on PineMarket (0% fees for 6 months)";

    const html = `
  <div style="font-family:-apple-system,Segoe UI,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111;line-height:1.55">
    <h2 style="margin:0 0 16px">Hey ${escapeHtml(firstName)},</h2>
    <p>Thanks for signing up on the PineMarket interest list — you're one of the first traders who raised your hand, and I want to return the favor.</p>
    <p>We're now onboarding a small group of <strong>founding sellers</strong> ahead of our public launch, and I'd like to invite you in.</p>
    <h3 style="margin:24px 0 8px">What you get as a founding seller</h3>
    <ul style="padding-left:20px;margin:0 0 16px">
      <li>🎁 <strong>0% platform fees for 6 months</strong> — 100% of every sale (minus Stripe processing) goes to you.</li>
      <li>⚡ Automated TradingView access — buyers get instant delegated access after purchase.</li>
      <li>💳 Direct Stripe payouts to your own account.</li>
      <li>📈 A public seller storefront you can share right now, before the marketplace opens.</li>
    </ul>
    ${accessCode ? `
    <div style="background:#f5f5f5;border-radius:8px;padding:16px;margin:16px 0">
      <p style="margin:0 0 4px;font-size:13px;color:#555">Your founding seller access code</p>
      <p style="margin:0;font-family:ui-monospace,Menlo,monospace;font-size:18px;letter-spacing:1px"><strong>${escapeHtml(accessCode)}</strong></p>
    </div>` : ''}
    <p style="margin:24px 0">
      <a href="${signupUrl}" style="display:inline-block;background:#111;color:#fff;padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:600">Start seller onboarding →</a>
    </p>
    <p style="font-size:13px;color:#555">Or copy this link: <br><a href="${signupUrl}">${signupUrl}</a></p>
    <p style="margin-top:32px">Reply to this email if you have any questions — I'm happy to help you get set up.</p>
    <p style="margin:16px 0 0">— The PineMarket team</p>
  </div>`;

    const text = `Hey ${firstName},

Thanks for signing up on the PineMarket interest list. We're now onboarding a small group of founding sellers ahead of our public launch, and I'd like to invite you in.

What you get as a founding seller:
- 0% platform fees for 6 months (100% of every sale minus Stripe processing goes to you)
- Automated TradingView access — buyers get instant delegated access after purchase
- Direct Stripe payouts to your own account
- A public seller storefront you can share right now
${accessCode ? `\nYour founding seller access code: ${accessCode}\n` : ''}
Start seller onboarding: ${signupUrl}

Reply to this email if you have any questions.

— The PineMarket team`;

    const response = await fetch(`${GATEWAY_URL}/emails`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'X-Connection-Api-Key': RESEND_API_KEY,
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: [email],
        subject,
        html,
        text,
        reply_to: 'capitalcodersllc@gmail.com',
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`Resend send failed [${response.status}]: ${errorBody}`);
      return json({ error: 'Provider request failed', status: response.status, details: errorBody }, response.status);
    }

    const data = await response.json();
    return json({ ok: true, id: data?.id ?? null });
  } catch (err) {
    console.error('send-founding-seller-invite error', err);
    return json({ error: (err as Error).message || 'unknown error' }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function escapeHtml(s: string) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}