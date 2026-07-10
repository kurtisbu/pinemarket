// Sends email notifications for support tickets.
// - new_ticket / user_reply -> notify admin (capitalcodersllc@gmail.com)
// - admin_reply -> notify ticket user
//
// Uses the project's `send-transactional-email` edge function if it exists.
// Falls back to logging when email infrastructure has not been set up yet.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ADMIN_EMAIL = 'capitalcodersllc@gmail.com';
const APP_URL = Deno.env.get('APP_URL') || 'https://pinemarket.io';
const DISCORD_WEBHOOK_URL = Deno.env.get('DISCORD_SUPPORT_WEBHOOK_URL') || '';

interface Payload {
  ticketId: string;
  kind: 'new_ticket' | 'user_reply' | 'admin_reply';
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { ticketId, kind } = (await req.json()) as Payload;
    if (!ticketId || !kind) {
      return new Response(JSON.stringify({ error: 'ticketId and kind required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: ticket, error: tErr } = await supabase
      .from('support_tickets')
      .select('id, subject, category, status, email, display_name')
      .eq('id', ticketId)
      .single();
    if (tErr || !ticket) throw tErr || new Error('Ticket not found');

    const { data: lastMsg } = await supabase
      .from('support_ticket_messages')
      .select('body, author_name, author_type, is_internal_note, created_at')
      .eq('ticket_id', ticketId)
      .eq('is_internal_note', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const isAdminBound = kind === 'new_ticket' || kind === 'user_reply';
    const to = isAdminBound ? ADMIN_EMAIL : ticket.email;
    const link = isAdminBound
      ? `${APP_URL}/admin`
      : `${APP_URL}/support/${ticket.id}`;

    const subjectLine =
      kind === 'new_ticket'
        ? `[Support] New ticket: ${ticket.subject}`
        : kind === 'user_reply'
        ? `[Support] Reply from ${ticket.display_name || ticket.email}: ${ticket.subject}`
        : `[PineMarket Support] Re: ${ticket.subject}`;

    const greeting = isAdminBound
      ? `Ticket from ${ticket.display_name || ticket.email}`
      : `Hi ${ticket.display_name || 'there'},`;

    const intro = isAdminBound
      ? kind === 'new_ticket'
        ? 'A new support ticket has been opened.'
        : 'The user replied to a support ticket.'
      : 'PineMarket Support replied to your ticket.';

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111">
        <h2 style="margin:0 0 12px">${escapeHtml(subjectLine)}</h2>
        <p style="margin:0 0 8px">${escapeHtml(greeting)}</p>
        <p style="margin:0 0 16px">${escapeHtml(intro)}</p>
        <div style="background:#f5f5f5;border-radius:8px;padding:16px;margin:0 0 20px">
          <p style="margin:0 0 6px"><strong>Subject:</strong> ${escapeHtml(ticket.subject)}</p>
          <p style="margin:0 0 6px"><strong>Category:</strong> ${escapeHtml(ticket.category)}</p>
          ${lastMsg ? `<p style="margin:12px 0 0;white-space:pre-wrap">${escapeHtml(lastMsg.body)}</p>` : ''}
        </div>
        <a href="${link}" style="display:inline-block;background:#111;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">View ticket</a>
      </div>
    `;

    const text = `${subjectLine}\n\n${intro}\n\nSubject: ${ticket.subject}\nCategory: ${ticket.category}\n\n${
      lastMsg?.body || ''
    }\n\nView ticket: ${link}`;

    // Try to use the project's transactional email pipeline.
    let delivered = false;
    try {
      const { error: invokeErr } = await supabase.functions.invoke('send-transactional-email', {
        body: {
          templateName: 'support-notification',
          recipientEmail: to,
          idempotencyKey: `support-${ticketId}-${kind}-${lastMsg?.created_at || Date.now()}`,
          templateData: {
            subject: subjectLine,
            ticketSubject: ticket.subject,
            category: ticket.category,
            greeting,
            intro,
            body: lastMsg?.body || '',
            link,
          },
        },
      });
      if (!invokeErr) delivered = true;
    } catch (_) {
      // function may not be deployed yet
    }

    // Forward admin-bound notifications to Discord (fire-and-forget)
    let discordDelivered = false;
    if (isAdminBound && DISCORD_WEBHOOK_URL) {
      try {
        const color =
          kind === 'new_ticket' ? 0x22c55e : kind === 'user_reply' ? 0x3b82f6 : 0x64748b;
        const title =
          kind === 'new_ticket'
            ? `🆕 New support ticket: ${ticket.subject}`
            : `💬 Reply on ticket: ${ticket.subject}`;
        const bodyPreview = (lastMsg?.body || '').slice(0, 1800);
        const payload = {
          username: 'PineMarket Support',
          embeds: [
            {
              title,
              url: `${APP_URL}/admin`,
              color,
              fields: [
                { name: 'From', value: `${ticket.display_name || 'Anonymous'} (${ticket.email})`, inline: false },
                { name: 'Category', value: String(ticket.category), inline: true },
                { name: 'Status', value: String(ticket.status), inline: true },
                ...(bodyPreview ? [{ name: 'Message', value: bodyPreview, inline: false }] : []),
              ],
              timestamp: new Date().toISOString(),
              footer: { text: `Ticket ${ticket.id}` },
            },
          ],
        };
        const res = await fetch(DISCORD_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        discordDelivered = res.ok;
        if (!res.ok) {
          console.error('Discord webhook failed', res.status, await res.text());
        }
      } catch (err) {
        console.error('Discord webhook error', err);
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        delivered,
        discordDelivered,
        to,
        kind,
        // Returned for debugging / fallback display in dashboard:
        previewHtml: delivered ? undefined : html,
        previewText: delivered ? undefined : text,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('send-support-notification error', err);
    return new Response(
      JSON.stringify({ error: (err as Error).message || 'unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});

function escapeHtml(s: string) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}